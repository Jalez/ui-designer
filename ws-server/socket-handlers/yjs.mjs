import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { logCollaborationStep } from "../log-collaboration-step.mjs";
import * as syncProtocol from "y-protocols/sync";
import { extractGroupIdFromRoomId, parseRoomContext } from "../room-context.mjs";
import { createYjsTrafficMonitor } from "../yjs-traffic-monitor.mjs";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */
const yjsTrafficMonitor = createYjsTrafficMonitor();
const recentSyncUpdateFingerprintBySocket = new WeakMap();
const DUPLICATE_UPDATE_WINDOW_MS = 2000;
const yjsHandshakeStateBySocket = new WeakMap();
/**
 * COLLABORATION STEP 9.2:
 * Accept an incoming Yjs packet from one browser and apply it to the shared room
 * state. In plain language, this is where one user's edit or awareness update
 * becomes part of the room's canonical collaboration session.
 */
async function handleYjsProtocol({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("9.2", "handleYjsProtocol", {
    socketId,
    channel: data?.channel ?? null,
  });
  if (!ctx.isYjsEnabled()) {
    return;
  }

  const roomId = resolveRoomId(socket, data);
  if (
    !roomId
    || (data.channel !== "sync" && data.channel !== "awareness")
    || typeof data.payloadBase64 !== "string"
    || data.payloadBase64.length === 0
  ) {
    return;
  }

  // Default-deny: only a verified member of this room may touch its shared doc or
  // awareness state. An unknown socket is rejected instead of falling through as
  // an active writer.
  const existingUser = ctx.getRoomUsers(roomId).get(socket);
  if (!existingUser) {
    console.warn(`[yjs-protocol:not-in-room] room=${roomId} socket=${socketId} channel=${data.channel}`);
    return;
  }
  const sessionRole = existingUser.sessionRole === "readonly" ? "readonly" : "active";

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx) {
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  const messageGeneration = Number.isInteger(data.yjsDocGeneration) ? data.yjsDocGeneration : null;
  const currentGeneration = ctx.getRoomYDocGeneration(roomId);
  if (messageGeneration != null && messageGeneration !== currentGeneration) {
    console.warn(
      `[yjs-protocol:drop] room=${roomId} socket=${socketId} channel=${data.channel} messageGeneration=${messageGeneration} currentGeneration=${currentGeneration}`
    );
    return;
  }
  const payload = ctx.decodeBase64Update(data.payloadBase64);
  const connectedUsers = ctx.getRoomUsers(roomId).size;
  if (data.channel === "awareness") {
    const awarenessDecoder = decoding.createDecoder(payload);
    const awarenessUpdate = decoding.readVarUint8Array(awarenessDecoder);
    ctx.applyYjsAwarenessUpdate(roomId, state, awarenessUpdate, socket);
    yjsTrafficMonitor.recordAwareness({
      roomId,
      socketId,
      payloadBase64: data.payloadBase64,
      payloadLen: data.payloadBase64.length,
      connectedUsers,
    });
    return;
  }

  // Peek the message type before readSyncMessage, which calls Y.applyUpdate synchronously.
  // Readonly sessions must not mutate the canonical doc — gate before any applyUpdate runs.
  // Both messageYjsUpdate and messageYjsSyncStep2 carry arbitrary updates; block both.
  const peekDecoder = decoding.createDecoder(payload);
  const peekMessageType = decoding.readVarUint(peekDecoder);
  if (
    sessionRole === "readonly"
    && (peekMessageType === syncProtocol.messageYjsUpdate || peekMessageType === syncProtocol.messageYjsSyncStep2)
  ) {
    console.log(`[yjs-protocol:readonly-drop] room=${roomId} socket=${socketId} messageType=${peekMessageType}`);
    return;
  }

  const doc = ctx.getOrCreateYDoc(roomId, state);
  const decoder = decoding.createDecoder(payload);
  const encoder = encoding.createEncoder();
  const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, socket);

  const handshakeState = yjsHandshakeStateBySocket.get(socket) || { isReady: false };
  // Treat either side of the initial sync handshake as the boundary: once the
  // socket has participated in SyncStep1 or SyncStep2, it is safe to accept
  // document updates. During reconnects the client often answers the server's
  // SyncStep1 with SyncStep2 before sending its own SyncStep1, so gating only on
  // SyncStep1 can incorrectly drop valid edits for an otherwise healthy session.
  if (
    syncMessageType === syncProtocol.messageYjsSyncStep1
    || syncMessageType === syncProtocol.messageYjsSyncStep2
  ) {
    handshakeState.isReady = true;
    yjsHandshakeStateBySocket.set(socket, handshakeState);
  }

  // Hard guard: never accept document updates until the initial handshake completed.
  if (syncMessageType === syncProtocol.messageYjsUpdate && handshakeState.isReady !== true) {
    console.warn(`[yjs-protocol:prehandshake-drop] room=${roomId} socket=${socketId} messageType=update`);
    return;
  }

  // Defensive: drop duplicate update packets from the same socket in a short window.
  // This protects against reconnect/race conditions that can re-send the same update
  // and manifest as duplicated content.
  if (syncMessageType === syncProtocol.messageYjsUpdate) {
    const now = Date.now();
    const prev = recentSyncUpdateFingerprintBySocket.get(socket);
    const fingerprint = `${roomId}|${data.payloadBase64}`;
    if (prev && prev.fingerprint === fingerprint && now - prev.at < DUPLICATE_UPDATE_WINDOW_MS) {
      console.warn(`[yjs-protocol:dedupe-drop] room=${roomId} socket=${socketId} windowMs=${DUPLICATE_UPDATE_WINDOW_MS}`);
      return;
    }
    recentSyncUpdateFingerprintBySocket.set(socket, { fingerprint, at: now });
  }

  yjsTrafficMonitor.recordSync({
    roomId,
    socketId,
    messageType: syncMessageType,
    payloadLen: data.payloadBase64.length,
    connectedUsers,
  });
  if (encoding.length(encoder) > 0) {
    ctx.sendYjsProtocol(socket, roomId, "sync", encoder);
  }
}

/**
 * COLLABORATION STEP 17.1:
 * Store one client's content fingerprint so the server can compare collaborators
 * and detect when two supposedly shared editors have silently drifted apart.
 */
async function handleClientStateHash({ socket, data, resolveRoomId, ctx }) {
  logCollaborationStep("17.1", "handleClientStateHash", {
    clientId: data?.clientId ?? null,
    editorType: data?.editorType ?? null,
    levelIndex: data?.levelIndex ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (
    !roomId
    || !data.clientId
    || !data.userId
    || !ctx.editorTypes.includes(data.editorType)
    || !Number.isInteger(data.levelIndex)
    || typeof data.contentHash !== "string"
  ) {
    return;
  }

  const report = {
    roomId,
    groupId: extractGroupIdFromRoomId(roomId),
    clientId: data.clientId,
    userId: ctx.getRoomUsers(roomId).get(socket)?.userId || data.userId,
    userEmail: ctx.getRoomUsers(roomId).get(socket)?.userEmail || (typeof data.userEmail === "string" ? data.userEmail : ""),
    engine: "yjs",
    editorType: data.editorType,
    levelIndex: data.levelIndex,
    contentHash: data.contentHash,
    contentLength: Number.isInteger(data.contentLength) ? data.contentLength : 0,
    version: Number.isInteger(data.version) ? data.version : null,
    isFocused: data.isFocused === true,
    isEditable: data.isEditable !== false,
    isTyping: data.isTyping === true,
    localInputAgeMs: Number.isInteger(data.localInputAgeMs) ? data.localInputAgeMs : null,
    remoteApplyAgeMs: Number.isInteger(data.remoteApplyAgeMs) ? data.remoteApplyAgeMs : null,
    receivedAt: Date.now(),
  };
  ctx.getRoomClientHashes(roomId).set(report.clientId, report);
  await ctx.evaluateClientStateHashes(roomId, report);
}

/**
 * COLLABORATION STEP 17.2:
 * Record client-side health warnings that help explain stalls, blocked editors,
 * and other collaboration problems beyond raw content mismatches.
 */
async function handleClientHealthEvent({ socket, data, resolveRoomId }) {
  logCollaborationStep("17.2", "handleClientHealthEvent", {
    clientId: data?.clientId ?? null,
    eventType: data?.eventType ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId || typeof data.eventType !== "string" || !data.clientId || !data.userId) {
    return;
  }
  const severity = data.severity === "error" ? "error" : data.severity === "warn" ? "warn" : "info";
  const logLine =
    `[client-health:${severity}] room=${roomId} clientId=${data.clientId} userId=${data.userId} ` +
    `editorType=${data.editorType || "none"} levelIndex=${Number.isInteger(data.levelIndex) ? data.levelIndex : "none"} ` +
    `event=${data.eventType} details=${JSON.stringify(data.details || {})}`;
  if (severity === "error") {
    console.error(logLine);
  } else if (severity === "warn") {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }
}

export const yjsHandlers = {
  "yjs-protocol": handleYjsProtocol,
  "client-state-hash": handleClientStateHash,
  "client-health-event": handleClientHealthEvent,
};
