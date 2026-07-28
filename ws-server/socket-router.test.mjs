import test from "node:test";
import assert from "node:assert/strict";
import { createSocketHandlerRegistry, createSocketMessageRouter } from "./socket-router.mjs";
import { createWsTransportStats } from "./ws-transport-stats.mjs";

function createTestContext(overrides = {}) {
  const sent = [];
  const warnings = [];
  const transportStats = createWsTransportStats({
    logger: { warn: (message) => warnings.push(message) },
    unknownMessageLogCooldownMs: 0,
  });
  const base = {
    sent,
    warnings,
    transportStats,
    maybeDelaySocketHandling: async () => {},
    parseEnvelope: () => ({ type: "unknown", payload: {} }),
    sendMessage: (socket, type, payload) => {
      sent.push({ socket, type, payload });
    },
    getConnectionState: () => ({ roomId: "room-1" }),
    getConnectionId: () => "socket-1",
  };
  return { ...base, ...overrides };
}

test("socket-router: invalid envelope sends invalid-message error", async () => {
  const ctx = createTestContext({
    parseEnvelope: () => null,
  });
  const route = createSocketMessageRouter(ctx);
  const socket = {};

  await route(socket, Buffer.from("not-json"));

  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].type, "error");
  assert.deepEqual(ctx.sent[0].payload, { error: "Invalid message" });
  assert.equal(ctx.transportStats.getSnapshot().invalidInboundMessages, 1);
});

test("socket-router: invalid payload for a known message type returns invalid-payload error", async () => {
  const ctx = createTestContext({
    parseEnvelope: () => ({
      type: "yjs-protocol",
      payload: {
        roomId: "group:room-1:game:game-1",
        channel: "sync",
        payloadBase64: "",
      },
    }),
  });
  const route = createSocketMessageRouter(ctx);
  const socket = {};

  await route(socket, Buffer.from("{}"));

  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].type, "error");
  assert.deepEqual(ctx.sent[0].payload, {
    error: "Invalid payload",
    code: "invalid_payload",
    type: "yjs-protocol",
  });
  assert.equal(ctx.transportStats.getSnapshot().invalidInboundMessages, 1);
});

test("socket-router: unknown message type is ignored but tracked", async () => {
  const ctx = createTestContext({
    parseEnvelope: () => ({ type: "non-existent-event", payload: {} }),
  });
  const route = createSocketMessageRouter(ctx);
  const socket = {};

  await route(socket, Buffer.from("{}"));

  assert.equal(ctx.sent.length, 0);
  assert.equal(ctx.transportStats.getSnapshot().unknownInboundMessages, 1);
  assert.equal(ctx.warnings.length, 1);
  assert.match(ctx.warnings[0], /ws-unknown-message/);
});

test("socket-router: thrown handler is caught and returns internal-server error", async () => {
  const ctx = createTestContext({
    parseEnvelope: () => ({ type: "boom", payload: {} }),
  });
  const route = createSocketMessageRouter(ctx, {
    handlers: {
      boom: async () => {
        throw new Error("expected test throw");
      },
    },
  });
  const socket = {};
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    await route(socket, Buffer.from("{}"));
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(ctx.sent.length, 1);
  assert.equal(ctx.sent[0].type, "error");
  assert.deepEqual(ctx.sent[0].payload, { error: "Internal server error" });
});

test("socket-router: payload roomId cannot retarget another room", async () => {
  const ctx = createTestContext({
    parseEnvelope: () => ({
      type: "progress-sync",
      payload: {
        roomId: "group:victim:game:game-9",
        clientId: "client-1",
        userId: "user-1",
        progressData: {},
      },
    }),
  });
  const handled = [];
  const route = createSocketMessageRouter(ctx, {
    handlers: { "progress-sync": async () => handled.push("called") },
  });
  const originalConsoleWarn = console.warn;
  console.warn = () => {};
  try {
    await route({}, Buffer.from("{}"));
  } finally {
    console.warn = originalConsoleWarn;
  }

  assert.deepEqual(handled, []);
  assert.equal(ctx.sent.length, 1);
  assert.deepEqual(ctx.sent[0].payload, { error: "Not in room", code: "not_in_room" });
});

test("socket-router: messages before join-game are rejected", async () => {
  const ctx = createTestContext({
    getConnectionState: () => ({ roomId: null }),
    parseEnvelope: () => ({
      type: "yjs-protocol",
      payload: {
        roomId: "group:room-1:game:game-1",
        channel: "sync",
        payloadBase64: "AAAA",
      },
    }),
  });
  const handled = [];
  const route = createSocketMessageRouter(ctx, {
    handlers: { "yjs-protocol": async () => handled.push("called") },
  });
  const originalConsoleWarn = console.warn;
  console.warn = () => {};
  try {
    await route({}, Buffer.from("{}"));
  } finally {
    console.warn = originalConsoleWarn;
  }

  assert.deepEqual(handled, []);
  assert.equal(ctx.sent.length, 1);
  assert.deepEqual(ctx.sent[0].payload, { error: "Not in room", code: "not_in_room" });
});

test("socket-router: handlers resolve the joined room, not the payload room", async () => {
  const ctx = createTestContext({
    parseEnvelope: () => ({
      type: "progress-sync",
      payload: {
        groupId: "other-group",
        clientId: "client-1",
        userId: "user-1",
        progressData: {},
      },
    }),
  });
  const resolved = [];
  const route = createSocketMessageRouter(ctx, {
    handlers: {
      "progress-sync": async ({ socket, data, resolveRoomId }) => {
        resolved.push(resolveRoomId(socket, data));
      },
    },
  });

  await route({}, Buffer.from("{}"));

  assert.deepEqual(resolved, ["room-1"]);
  assert.equal(ctx.sent.length, 0);
});

test("socket-router: removed legacy editor/presence message handlers are not registered", () => {
  const handlers = createSocketHandlerRegistry();
  const removed = [
    "editor-change",
    "editor-change-applied",
    "editor-resync",
    "editor-cursor",
    "typing-status",
    "tab-focus",
  ];
  for (const messageType of removed) {
    assert.equal(Object.prototype.hasOwnProperty.call(handlers, messageType), false);
  }
});
