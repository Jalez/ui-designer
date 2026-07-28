import { logCollaborationStep } from "../log-collaboration-step.mjs";
import { extractGroupIdFromRoomId, parseRoomContext } from "../room-context.mjs";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";

/**
 * @typedef {import("../ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

/**
 * COLLABORATION STEP 18.8:
 * Send one client a fresh room snapshot when it asks for recovery or suspects it
 * missed authoritative room metadata.
 */
async function handleRequestRoomStateSync({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.8", "handleRequestRoomStateSync", {
    socketId,
    reason: data?.reason ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx) {
    console.log(`[room-state-sync:skip] room=${roomId} target=${socketId} reason=invalid-room-context-request`);
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  ctx.setHandshakeGrace(socket);
  ctx.sendMessage(socket, "room-state-sync", ctx.serializeRoomStateSync(roomId, state));
  const groupStartSync = ctx.serializeGroupStartSync(roomId, state);
  if (groupStartSync) {
    ctx.sendMessage(socket, "group-start-sync", groupStartSync);
  }
  if (ctx.isYjsEnabled()) {
    const doc = ctx.getOrCreateYDoc(roomId, state);
    const snapshotEncoder = encoding.createEncoder();
    syncProtocol.writeSyncStep2(snapshotEncoder, doc);
    ctx.sendYjsProtocol(socket, roomId, "sync", snapshotEncoder);

    const handshakeEncoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(handshakeEncoder, doc);
    ctx.sendYjsProtocol(socket, roomId, "sync", handshakeEncoder);

    ctx.sendFullAwarenessState(socket, roomId, state);
  }
  ctx.clearHandshakeGrace(socket);
  console.log(
    `[room-state-sync:emit] room=${roomId} target=${socketId} reason=request levelsCount=${state.levels.length}`
  );
}

/**
 * COLLABORATION STEP 18.9:
 * Merge shared non-code progress data into the room state and rebroadcast it to
 * the rest of the group so room metadata stays aligned with the shared code.
 */
async function handleProgressSync({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.9", "handleProgressSync", {
    socketId,
    keys: Object.keys(data?.progressData ?? {}),
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx || roomCtx.kind !== "instance") {
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  const incomingProgress =
    data?.progressData && typeof data.progressData === "object" && !Array.isArray(data.progressData)
      ? data.progressData
      : null;
  if (!incomingProgress) {
    return;
  }

  if (ctx.isGroupInstanceContext(roomCtx) && "groupStartGate" in incomingProgress) {
    delete incomingProgress.groupStartGate;
  }

  state.progressData = {
    ...state.progressData,
    ...incomingProgress,
    levels: state.progressData.levels,
  };
  ctx.applyStartedGateToLevels(state);

  ctx.broadcastToRoom(roomId, "progress-sync", {
    progressData: incomingProgress,
    ts: Date.now(),
  }, socket);
  console.log(`[progress-sync] room=${roomId} from=${socketId} keys=${Object.keys(incomingProgress).join(",")}`);
  if (Array.isArray(state.progressData.levels) && Array.isArray(incomingProgress.levels)) {
    incomingProgress.levels.forEach((incomingLevel, levelIndex) => {
      const previousLevel = state.progressData.levels[levelIndex] || {};
      ["lockHTML", "lockCSS", "lockJS"].forEach((lockKey) => {
        if (typeof incomingLevel?.[lockKey] === "boolean" && incomingLevel[lockKey] !== previousLevel?.[lockKey]) {
          console.log(
            `[lock-state] room=${roomId} from=${socketId} gameId=${roomCtx.gameId} groupId=${roomCtx.groupId || "none"} instanceId=${state.instanceId || "none"} levelIndex=${levelIndex} key=${lockKey} prev=${Boolean(previousLevel?.[lockKey])} next=${Boolean(incomingLevel[lockKey])}`
          );
        }
      });
    });
  }
}

/**
 * COLLABORATION STEP 18.10:
 * Coordinate the "everyone is ready" gate for group play. This is adjacent to
 * code sync because it changes shared room state and can trigger a room resync.
 */
async function handleGroupStart({ socket, data, envelope, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.10", "handleGroupStart", {
    socketId,
    messageType: envelope.type,
    userId: data?.userId ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!ctx.isGroupInstanceContext(roomCtx)) {
    return;
  }

  const roomUser = ctx.getRoomUsers(roomId).get(socket);
  const userId = typeof roomUser?.userId === "string" ? roomUser.userId : "";
  if (!userId) {
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  const gate = ctx.ensureGroupStartGate(state);
  if (!gate) {
    return;
  }

  if (gate.status === "started") {
    const startedSync = ctx.serializeGroupStartSync(roomId, state);
    if (startedSync) {
      ctx.sendMessage(socket, "group-start-sync", startedSync);
    }
    return;
  }

  if (envelope.type === "group-start-ready") {
    if (!gate.readyUserIds.includes(userId)) {
      gate.readyUserIds = [...gate.readyUserIds, userId];
    }
    gate.readyUsers = {
      ...gate.readyUsers,
      [userId]: {
        userId,
        ...(typeof roomUser?.userName === "string" ? { userName: roomUser.userName } : {}),
        ...(typeof roomUser?.userEmail === "string" ? { userEmail: roomUser.userEmail } : {}),
        ...(typeof roomUser?.userImage === "string" ? { userImage: roomUser.userImage } : {}),
        readyAt: new Date().toISOString(),
      },
    };
  } else {
    gate.readyUserIds = gate.readyUserIds.filter((entry) => entry !== userId);
    const nextReadyUsers = { ...gate.readyUsers };
    delete nextReadyUsers[userId];
    gate.readyUsers = nextReadyUsers;
  }

  if (gate.readyUserIds.length >= gate.minReadyCount) {
    gate.status = "started";
    gate.startedAt = new Date().toISOString();
    gate.startedByUserId = userId;
    ctx.applyStartedGateToLevels(state);
    ctx.sendMessage(socket, "room-state-sync", ctx.serializeRoomStateSync(roomId, state));
    ctx.broadcastToRoom(roomId, "room-state-sync", ctx.serializeRoomStateSync(roomId, state), socket);
  }

  state.progressData = {
    ...state.progressData,
    groupStartGate: gate,
  };
  ctx.markRoomDirty(roomId, roomCtx);

  const syncPayload = ctx.serializeGroupStartSync(roomId, state);
  if (syncPayload) {
    ctx.sendMessage(socket, "group-start-sync", syncPayload);
    ctx.broadcastToRoom(roomId, "group-start-sync", syncPayload, socket);
  }

  ctx.broadcastToRoom(roomId, "progress-sync", {
    progressData: { groupStartGate: gate },
    ts: Date.now(),
  }, socket);
  ctx.sendMessage(socket, "progress-sync", {
    progressData: { groupStartGate: gate },
    ts: Date.now(),
  });
  console.log(
    `[group-start:${envelope.type === "group-start-ready" ? "ready" : "unready"}] room=${roomId} from=${socketId} userId=${userId} readyCount=${gate.readyUserIds.length}/${gate.minReadyCount} status=${gate.status}`
  );
  ctx.logRoomSnapshot(envelope.type === "group-start-ready" ? "start-ready" : "start-unready", roomId, {
    by: socketId,
    readyCount: gate.readyUserIds.length,
    status: gate.status,
  });
}

/**
 * COLLABORATION STEP 18.11:
 * Perform a hard reset of one level or the full game, rebuild the room's shared
 * Yjs document, persist the new baseline, and broadcast the reset to the room.
 */
async function handleResetRoomState({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.11", "handleResetRoomState", {
    socketId,
    scope: data?.scope ?? null,
    levelIndex: data?.levelIndex ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx || roomCtx.kind !== "instance") {
    return;
  }

  // Resetting wipes the room baseline and persists it, so it needs a verified
  // member of this room holding an active (non-readonly) session.
  const room = ctx.rooms.get(roomId);
  const resetUser = room?.get(socket) || null;
  if (!resetUser) {
    console.warn(`[room-state-reset:deny] room=${roomId} by=${socketId} reason=not-in-room`);
    ctx.sendMessage(socket, "error", { error: "Not in room", code: "not_in_room" });
    return;
  }
  if (resetUser.sessionRole === "readonly") {
    console.warn(`[room-state-reset:deny] room=${roomId} by=${socketId} reason=readonly-session`);
    ctx.sendMessage(socket, "error", { error: "Read-only session cannot reset room state", code: "forbidden" });
    return;
  }
  const scope = data?.scope === "game" ? "game" : "level";
  const levelIndex = Number.isInteger(data?.levelIndex) ? data.levelIndex : 0;
  const currentState = await ctx.ensureRoomState(roomId, roomCtx);
  console.log(
    `[room-state-reset:start] room=${roomId} by=${socketId} groupId=${extractGroupIdFromRoomId(roomId) || "none"} scope=${scope} levelIndex=${levelIndex} levelsCount=${currentState.levels.length} mapName=${currentState.mapName || "none"}`
  );
  let templateLevels = currentState.mapName
    ? await ctx.fetchLevelsForMapName(currentState.mapName)
    : [];

  if (templateLevels.length === 0) {
    templateLevels = Array.isArray(currentState.templateLevels)
      ? currentState.templateLevels
      : [];
  }
  if (templateLevels.length === 0) {
    console.warn(
      `[room-state-reset:skip] room=${roomId} by=${socketId} reason=no-template-levels scope=${scope} levelIndex=${levelIndex}`
    );
    return;
  }

  const nextState = ctx.createRoomState(roomCtx, ctx.serializeProgressData(currentState), {
    templateLevels,
    mapName: currentState.mapName,
  });
  if (scope === "game") {
    nextState.levels = templateLevels.map((templateLevel) => ctx.createLevelState(templateLevel));
  } else {
    const templateLevel = templateLevels[levelIndex];
    if (!templateLevel) {
      return;
    }
    nextState.levels[levelIndex] = ctx.createLevelState(templateLevel);
  }
  ctx.applyStartedGateToLevels(nextState);
  ctx.roomEditorState.set(roomId, nextState);
  if (ctx.isYjsEnabled()) {
    const nextGeneration = Math.max(ctx.getRoomYDocGeneration(roomId) + 1, 1);
    ctx.createRoomYDoc(roomId, nextState, nextGeneration);
  }

  const existingBuffer = ctx.roomWriteBuffer.get(roomId);
  if (existingBuffer?.timer) {
    clearTimeout(existingBuffer.timer);
  }
  ctx.roomWriteBuffer.delete(roomId);

  const result = await ctx.saveProgressToDB(roomCtx, ctx.serializeCodeLevels(roomId, nextState));
  if (!result.ok && !result.permanentFailure) {
    ctx.markRoomDirty(roomId, roomCtx);
  }
  console.log(
    `[room-state-reset:save] room=${roomId} by=${socketId} ok=${result.ok} permanentFailure=${result.permanentFailure} dirty=${!result.ok && !result.permanentFailure} scope=${scope} levelIndex=${levelIndex}`
  );

  ctx.broadcastToRoom(roomId, "room-state-sync", ctx.serializeRoomStateSync(roomId, nextState));
  const groupStartSync = ctx.serializeGroupStartSync(roomId, nextState);
  if (groupStartSync) {
    ctx.broadcastToRoom(roomId, "group-start-sync", groupStartSync);
  }
  const resetNotice = {
    scope,
    levelIndex,
    userId: resetUser?.userId || (typeof data?.userId === "string" ? data.userId : ""),
    ...(typeof resetUser?.userName === "string" && resetUser.userName
      ? { userName: resetUser.userName }
      : {}),
    ...(typeof resetUser?.userEmail === "string" && resetUser.userEmail
      ? { userEmail: resetUser.userEmail }
      : {}),
    at: new Date().toISOString(),
  };
  ctx.broadcastToRoom(roomId, "progress-sync", {
    progressData: { resetNotice },
    ts: Date.now(),
  }, socket);
  console.log(`[room-state-sync:emit] room=${roomId} by=${socketId} reason=reset scope=${scope} levelIndex=${levelIndex}`);
}

/**
 * COLLABORATION STEP 18.12:
 * Apply a level metadata mutation (add/remove level, update meta fields) to the
 * authoritative room state and broadcast the change to all other collaborators.
 */
async function handleLevelMetaUpdate({ socket, data, socketId, resolveRoomId, ctx }) {
  logCollaborationStep("18.12", "handleLevelMetaUpdate", {
    socketId,
    operation: data?.operation ?? null,
    levelIndex: data?.levelIndex ?? null,
  });
  const roomId = resolveRoomId(socket, data);
  if (!roomId) {
    return;
  }

  const roomCtx = parseRoomContext(roomId);
  if (!roomCtx) {
    return;
  }

  const state = await ctx.ensureRoomState(roomId, roomCtx);
  const operation = data?.operation;

  if (operation === "add-level") {
    const levelData = data?.level && typeof data.level === "object" ? data.level : {};
    const newLevel = ctx.createLevelState(levelData);
    state.levels.push(newLevel);
    console.log(
      `[level-meta-update:add-level] room=${roomId} from=${socketId} newLevelCount=${state.levels.length}`
    );
  } else if (operation === "remove-level") {
    const levelIndex = Number.isInteger(data?.levelIndex) ? data.levelIndex : -1;
    if (levelIndex >= 0 && levelIndex < state.levels.length) {
      state.levels.splice(levelIndex, 1);
      console.log(
        `[level-meta-update:remove-level] room=${roomId} from=${socketId} removedIndex=${levelIndex} newLevelCount=${state.levels.length}`
      );
    } else {
      console.log(
        `[level-meta-update:remove-level:skip] room=${roomId} from=${socketId} invalidIndex=${levelIndex} levelCount=${state.levels.length}`
      );
      return;
    }
  } else if (operation === "update-level-meta") {
    const levelIndex = Number.isInteger(data?.levelIndex) ? data.levelIndex : -1;
    if (levelIndex < 0 || levelIndex >= state.levels.length) {
      console.log(
        `[level-meta-update:update-meta:skip] room=${roomId} from=${socketId} invalidIndex=${levelIndex} levelCount=${state.levels.length}`
      );
      return;
    }
    const fields = data?.fields && typeof data.fields === "object" ? data.fields : {};
    const level = state.levels[levelIndex];
    // Update the level name if included in the fields
    if (typeof fields.name === "string") {
      level.name = fields.name;
    }
    // Merge remaining fields into level.meta (the serialized non-code properties)
    for (const [key, value] of Object.entries(fields)) {
      if (key === "name" || key === "code" || key === "versions") {
        continue; // Skip code/versions — those are managed by Yjs
      }
      level.meta[key] = value;
    }
    console.log(
      `[level-meta-update:update-meta] room=${roomId} from=${socketId} levelIndex=${levelIndex} keys=${Object.keys(fields).join(",")}`
    );
  } else {
    console.log(
      `[level-meta-update:unknown-op] room=${roomId} from=${socketId} operation=${operation}`
    );
    return;
  }

  // Rebuild Yjs doc if level structure changed (add/remove)
  if ((operation === "add-level" || operation === "remove-level") && ctx.isYjsEnabled()) {
    const nextGeneration = Math.max(ctx.getRoomYDocGeneration(roomId) + 1, 1);
    ctx.createRoomYDoc(roomId, state, nextGeneration);
  }

  // Broadcast the update to all other clients
  ctx.broadcastToRoom(roomId, "level-meta-update", {
    operation,
    levelIndex: data?.levelIndex ?? null,
    fields: data?.fields ?? null,
    level: data?.level ?? null,
    ts: Date.now(),
  }, socket);

  // For structural changes, also send a full room-state-sync so all clients
  // reconcile their level arrays with the server's canonical state.
  if (operation === "add-level" || operation === "remove-level") {
    ctx.broadcastToRoom(roomId, "room-state-sync", ctx.serializeRoomStateSync(roomId, state));
    ctx.sendMessage(socket, "room-state-sync", ctx.serializeRoomStateSync(roomId, state));
  }

  // Mark dirty for persistence (instance rooms will save to DB)
  ctx.markRoomDirty(roomId, roomCtx);
}

export const progressHandlers = {
  "request-room-state-sync": handleRequestRoomStateSync,
  "progress-sync": handleProgressSync,
  "group-start-ready": handleGroupStart,
  "group-start-unready": handleGroupStart,
  "reset-room-state": handleResetRoomState,
  "level-meta-update": handleLevelMetaUpdate,
};
