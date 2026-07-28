import { editorHandlers } from "./socket-handlers/editor.mjs";
import { lobbyHandlers } from "./socket-handlers/lobby.mjs";
import { logCollaborationStep } from "./log-collaboration-step.mjs";
import { progressHandlers } from "./socket-handlers/progress.mjs";
import { sessionHandlers } from "./socket-handlers/session.mjs";
import { yjsHandlers } from "./socket-handlers/yjs.mjs";
import { validateIncomingEnvelope } from "./ws-protocol-schema.mjs";

/**
 * @typedef {import("./ws-runtime-context.mjs").WsRuntimeContext} WsRuntimeContext
 */

// Only these message types may name the room they act on. Every other message is
// resolved from the room the socket authenticated into at join time, so a client
// cannot reach into a room it never joined by rewriting the payload roomId.
const ROOM_BINDING_MESSAGE_TYPES = new Set(["join-game"]);

/**
 * COLLABORATION STEP 7.3:
 * Build the lookup table that maps incoming websocket message types to the
 * server function responsible for handling that collaboration step.
 */
export function createSocketHandlerRegistry() {
  logCollaborationStep("7.3", "createSocketHandlerRegistry");
  return {
    ...sessionHandlers,
    ...yjsHandlers,
    ...editorHandlers,
    ...progressHandlers,
    ...lobbyHandlers,
  };
}

/**
 * @param {WsRuntimeContext} ctx
 * @param {{ handlers?: Record<string, Function> }} [options]
 */
/**
 * COLLABORATION STEP 7.4:
 * Create the server-side websocket router. In plain language, this is the traffic
 * controller that validates each incoming packet and forwards it to the correct
 * collaboration handler.
 */
export function createSocketMessageRouter(ctx, options = {}) {
  logCollaborationStep("7.4", "createSocketMessageRouter");
  const handlers = options.handlers || createSocketHandlerRegistry();
  const resolveRequestedRoomId = (socket, data) => data?.roomId || data?.groupId || ctx.getConnectionState(socket)?.roomId || null;

  return async (socket, rawMessage) => {
    await ctx.maybeDelaySocketHandling();
    const envelope = ctx.parseEnvelope(rawMessage.toString());
    if (!envelope) {
      ctx.transportStats?.recordInvalidInboundMessage({
        socketId: ctx.getConnectionId(socket),
        roomId: ctx.getConnectionState(socket)?.roomId || null,
        code: "invalid_message",
      });
      ctx.sendMessage(socket, "error", { error: "Invalid message" });
      return;
    }
    const validation = validateIncomingEnvelope(envelope);
    if (!validation.ok) {
      ctx.transportStats?.recordInvalidInboundMessage({
        socketId: ctx.getConnectionId(socket),
        roomId: ctx.getConnectionState(socket)?.roomId || null,
        code: validation.code,
        type: validation.type,
      });
      ctx.sendMessage(socket, "error", {
        error: validation.code === "invalid_payload" ? "Invalid payload" : validation.error,
        code: validation.code,
        ...(validation.type ? { type: validation.type } : {}),
      });
      return;
    }

    const normalizedEnvelope = validation.value;
    const data = normalizedEnvelope.payload && typeof normalizedEnvelope.payload === "object" ? normalizedEnvelope.payload : {};
    const socketId = ctx.getConnectionId(socket);
    const handler = handlers[normalizedEnvelope.type];
    if (!handler) {
      ctx.transportStats?.recordUnknownInboundMessage({
        socketId,
        roomId: resolveRequestedRoomId(socket, data),
        type: normalizedEnvelope.type,
      });
      return;
    }

    // Bind the message to the room this socket joined. Handlers get a resolver that
    // always returns that room, and a payload naming a different room is rejected
    // instead of being silently retargeted at someone else's room.
    const joinedRoomId = ctx.getConnectionState(socket)?.roomId || null;
    let resolveRoomId = resolveRequestedRoomId;
    if (!ROOM_BINDING_MESSAGE_TYPES.has(normalizedEnvelope.type)) {
      const payloadRoomId = typeof data.roomId === "string" ? data.roomId : null;
      if (!joinedRoomId || (payloadRoomId && payloadRoomId !== joinedRoomId)) {
        console.warn(
          `[socket:room-mismatch] socket=${socketId} type=${normalizedEnvelope.type} joinedRoom=${joinedRoomId || "none"} payloadRoom=${payloadRoomId || "none"}`
        );
        ctx.transportStats?.recordInvalidInboundMessage({
          socketId,
          roomId: joinedRoomId,
          code: "room_not_joined",
          type: normalizedEnvelope.type,
        });
        ctx.sendMessage(socket, "error", { error: "Not in room", code: "not_in_room" });
        return;
      }
      resolveRoomId = () => joinedRoomId;
    }

    try {
      await handler({ socket, data, envelope: normalizedEnvelope, socketId, resolveRoomId, ctx });
    } catch (error) {
      const roomId = ctx.getConnectionState(socket)?.roomId || "none";
      console.error(`[socket:message-error] socket=${socketId} room=${roomId}`, error);
      ctx.sendMessage(socket, "error", { error: "Internal server error" });
    }
  };
}
