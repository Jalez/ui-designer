import { z } from "zod";

const MAX_ID_LENGTH = 256;
const MAX_TEXT_LENGTH = 4000;
const MAX_BASE64_PAYLOAD_LENGTH = 6 * 1024 * 1024;

const optionalString = (max = MAX_TEXT_LENGTH) => z.string().max(max).optional();
const requiredString = (max = MAX_ID_LENGTH) => z.string().min(1).max(max);
const roomLocatorSchema = z.object({
  roomId: requiredString().optional(),
  groupId: requiredString().optional(),
}).passthrough();

function withRequiredRoomLocator(extraShape = {}) {
  return roomLocatorSchema.extend(extraShape).refine(
    (value) => typeof value.roomId === "string" || typeof value.groupId === "string",
    { message: "roomId or groupId is required" }
  );
}

const joinGamePayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  authToken: requiredString(8192),
  sessionRole: z.enum(["active", "readonly"]).optional(),
});

const leaveGamePayloadSchema = withRequiredRoomLocator();

const canvasCursorPayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  userId: z.string().max(MAX_ID_LENGTH).optional(),
  userName: optionalString(256),
  color: optionalString(64),
  x: z.number().finite(),
  y: z.number().finite(),
});

const requestRoomStateSyncPayloadSchema = withRequiredRoomLocator({
  reason: optionalString(256),
});

const yjsProtocolPayloadSchema = withRequiredRoomLocator({
  channel: z.enum(["sync", "awareness"]),
  payloadBase64: z.string().min(1).max(MAX_BASE64_PAYLOAD_LENGTH),
  yjsDocGeneration: z.number().int().nonnegative().optional(),
});

const resetRoomStatePayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  userId: requiredString(),
  scope: z.enum(["level", "game"]),
  levelIndex: z.number().int().nonnegative().optional(),
});

const progressSyncPayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  userId: requiredString(),
  progressData: z.record(z.string(), z.unknown()),
});

const groupStartPayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  userId: requiredString(),
  userEmail: z.string().max(MAX_ID_LENGTH).optional(),
  userName: optionalString(256),
  userImage: optionalString(2048),
});

const lobbyChatPayloadSchema = z.object({
  roomId: requiredString(),
  clientId: requiredString(128),
  userId: requiredString(),
  userEmail: z.string().max(MAX_ID_LENGTH).optional(),
  userName: optionalString(256),
  userImage: optionalString(2048),
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
}).passthrough();

const clientStateHashPayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  userId: requiredString(),
  userEmail: z.string().max(MAX_ID_LENGTH).optional(),
  engine: z.string().max(32).optional(),
  editorType: z.enum(["html", "css", "js"]),
  levelIndex: z.number().int().nonnegative(),
  contentHash: requiredString(128),
  contentLength: z.number().int().nonnegative().optional(),
  version: z.number().int().nullable().optional(),
  isFocused: z.boolean().optional(),
  isEditable: z.boolean().optional(),
  isTyping: z.boolean().optional(),
  localInputAgeMs: z.number().int().nonnegative().nullable().optional(),
  remoteApplyAgeMs: z.number().int().nonnegative().nullable().optional(),
});

const levelMetaUpdatePayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  userId: requiredString(),
  operation: z.enum([
    "update-level-meta",
    "add-level",
    "remove-level",
  ]),
  levelIndex: z.number().int().nonnegative().optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  level: z.record(z.string(), z.unknown()).optional(),
});

const clientHealthEventPayloadSchema = withRequiredRoomLocator({
  clientId: requiredString(128),
  userId: requiredString(),
  userEmail: z.string().max(MAX_ID_LENGTH).optional(),
  engine: z.string().max(32).optional(),
  eventType: requiredString(128),
  severity: z.enum(["info", "warn", "error"]).optional(),
  editorType: z.enum(["html", "css", "js"]).optional(),
  levelIndex: z.number().int().nonnegative().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

const incomingEnvelopeSchema = z.object({
  type: requiredString(128),
  payload: z.unknown().optional(),
  ts: z.number().int().nonnegative().optional(),
}).passthrough();

export const inboundPayloadSchemas = {
  "join-game": joinGamePayloadSchema,
  "leave-game": leaveGamePayloadSchema,
  "reclaim-session": withRequiredRoomLocator(),
  "canvas-cursor": canvasCursorPayloadSchema,
  "request-room-state-sync": requestRoomStateSyncPayloadSchema,
  "yjs-protocol": yjsProtocolPayloadSchema,
  "reset-room-state": resetRoomStatePayloadSchema,
  "progress-sync": progressSyncPayloadSchema,
  "group-start-ready": groupStartPayloadSchema,
  "group-start-unready": groupStartPayloadSchema,
  "lobby-chat-send": lobbyChatPayloadSchema,
  "level-meta-update": levelMetaUpdatePayloadSchema,
  "client-state-hash": clientStateHashPayloadSchema,
  "client-health-event": clientHealthEventPayloadSchema,
};

export const knownInboundMessageTypes = Object.freeze(Object.keys(inboundPayloadSchemas));

function formatIssues(error) {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  }).join("; ");
}

export function validateIncomingEnvelope(envelope) {
  const envelopeResult = incomingEnvelopeSchema.safeParse(envelope);
  if (!envelopeResult.success) {
    return {
      ok: false,
      error: "Invalid message",
      code: "invalid_message",
      detail: formatIssues(envelopeResult.error),
    };
  }

  const normalizedEnvelope = envelopeResult.data;
  const payloadSchema = inboundPayloadSchemas[normalizedEnvelope.type];
  if (!payloadSchema) {
    return {
      ok: true,
      value: {
        ...normalizedEnvelope,
        payload:
          normalizedEnvelope.payload && typeof normalizedEnvelope.payload === "object" && !Array.isArray(normalizedEnvelope.payload)
            ? normalizedEnvelope.payload
            : {},
      },
    };
  }

  const payloadResult = payloadSchema.safeParse(normalizedEnvelope.payload);
  if (!payloadResult.success) {
    return {
      ok: false,
      error: "Invalid payload",
      code: "invalid_payload",
      detail: formatIssues(payloadResult.error),
      type: normalizedEnvelope.type,
    };
  }

  return {
    ok: true,
    value: {
      ...normalizedEnvelope,
      payload: payloadResult.data,
    },
  };
}

export const WS_PROTOCOL_SCHEMA_DOC = true;
