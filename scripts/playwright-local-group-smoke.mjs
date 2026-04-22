import { chromium, expect, firefox, webkit } from "@playwright/test";
import { TOUR_SPOT_ACKS } from "./playwright-tour-acks.mjs";
import { Client } from "pg";
import { readFileSync } from "fs";
import dotenv from "dotenv";
import path from "node:path";
import net from "net";
import tls from "tls";
import { randomBytes } from "crypto";
import { execFile, spawn } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const scenario = process.env.PLAYWRIGHT_SCENARIO || "baseline";
const browserName = process.env.PLAYWRIGHT_BROWSER || "chromium";
const routeKind = process.env.PLAYWRIGHT_ROUTE_KIND || (scenario === "prototype_yjs" ? "prototype-yjs" : "game");
const requestedGameId = process.env.PLAYWRIGHT_GAME_ID || null;
const headed = process.env.PLAYWRIGHT_HEADED === "true";
const keepOpen = process.env.PLAYWRIGHT_KEEP_OPEN === "true";
const createWaitMs = Number.parseInt(process.env.PLAYWRIGHT_WAIT_MS || "1200", 10);
const concurrentEditors = Math.max(2, Number.parseInt(process.env.PLAYWRIGHT_CONCURRENT_EDITORS || "2", 10));
const timeoutMultiplier = Math.max(1, Number.parseFloat(process.env.PLAYWRIGHT_TIMEOUT_MULTIPLIER || "1"));
const verboseYjsLogs = process.env.PLAYWRIGHT_VERBOSE_YJS === "true";
const verboseBrowserLogs = process.env.PLAYWRIGHT_VERBOSE_BROWSER === "true";
const dbUrl = process.env.PLAYWRIGHT_DATABASE_URL || process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/hello_ui";
let activeGameId = requestedGameId;
const smokeViewport = {
  width: Number.parseInt(process.env.PLAYWRIGHT_VIEWPORT_WIDTH || "430", 10),
  height: Number.parseInt(process.env.PLAYWRIGHT_VIEWPORT_HEIGHT || "932", 10),
};

function scaledTimeout(ms) {
  return Math.round(ms * timeoutMultiplier);
}

function printRunSummary(scenarioName, passed, checks = {}, params = {}) {
  console.log("");
  console.log("=".repeat(60));
  console.log(`Scenario: ${scenarioName}`);
  console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  const entries = Object.entries(checks);
  if (entries.length > 0) {
    for (const [name, ok] of entries) {
      console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
    }
  }
  const paramEntries = Object.entries(params);
  if (paramEntries.length > 0) {
    console.log(`Params: ${paramEntries.map(([k, v]) => `${k}=${v}`).join(" ")}`);
  }
  console.log("=".repeat(60));
  if (!passed) {
    process.exitCode = 1;
  }
}

function generateUsernames(count) {
  return Array.from({ length: count }, (_, index) => `user${String(index + 1).padStart(2, "0")}`);
}

function deriveUsernames() {
  const provided = (process.env.PLAYWRIGHT_USERNAMES || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (provided.length > 0) {
    return provided;
  }

  if (scenario === "same_user_duplicate" || scenario === "same_user_blocked") {
    return ["user01", "user02", "user02"];
  }

  if (scenario === "duplicate_churn") {
    return ["user01", "user02", "user02", "user03"];
  }

  if (scenario === "refresh_desync") {
    return ["user01", "user02"];
  }

  if (scenario === "in_game_duplicate") {
    return ["user01", "user02", "user02", "user03"];
  }

  const defaultByScenario = {
    baseline: 5,
    lti_lobby: 6,
    lti_aplus_group: 4,
    classroom_churn: 12,
    classroom_text_production: 12,
    creator_group_details: 4,
    level_tab_switch: 3,
    instances_reset: 3,
    same_user_duplicate: 3,
    same_user_blocked: 3,
    duplicate_churn: 4,
    refresh_desync: 2,
    in_game_churn: 4,
    in_game_duplicate: 4,
    ws_invalid_rsv1: 1,
    ws_recovery: 3,
    prototype_yjs: 12,
    game_yjs: 12,
    submit_after_churn: 12,
    latency: 8,
  };
  const userCount = Number.parseInt(process.env.PLAYWRIGHT_USER_COUNT || `${defaultByScenario[scenario] || 5}`, 10);
  return generateUsernames(userCount);
}

const usernames = deriveUsernames();

function defaultGroupSizeForScenario() {
  if (scenario === "baseline") return 3;
  if (scenario === "same_user_duplicate") return 3;
  if (scenario === "duplicate_churn") return 4;
  if (scenario === "refresh_desync") return 2;
  if (scenario === "in_game_churn") return 4;
  if (scenario === "in_game_duplicate") return 4;
  if (scenario === "same_user_blocked") return 3;
  if (scenario === "lti_aplus_group") return 2;
  if (scenario === "latency") return 4;
  if (scenario === "creator_group_details") return 3;
  if (scenario === "level_tab_switch") return 3;
  if (scenario === "instances_reset") return 3;
  if (scenario === "classroom_text_production") return 3;
  return 3;
}

function partitionIndexes(totalUsers, groupSize) {
  const layouts = [];
  for (let index = 0; index < totalUsers; index += groupSize) {
    layouts.push(Array.from({ length: Math.min(groupSize, totalUsers - index) }, (_, offset) => index + offset));
  }
  return layouts.filter((layout) => layout.length > 0);
}

function buildGroupLayouts() {
  const raw = process.env.PLAYWRIGHT_GROUP_LAYOUT;
  if (raw) {
    const groups = raw
      .split(";")
      .map((group) => group.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))
      .filter((group) => group.length > 0);
    const usernameToIndex = new Map(usernames.map((username, index) => [username, index]));
    return groups.map((group) => group.map((username) => {
      const index = usernameToIndex.get(username);
      if (index === undefined) {
        throw new Error(`Unknown username in PLAYWRIGHT_GROUP_LAYOUT: ${username}`);
      }
      return index;
    }));
  }

  const groupSize = Number.parseInt(process.env.PLAYWRIGHT_GROUP_SIZE || `${defaultGroupSizeForScenario()}`, 10);
  const layout = partitionIndexes(usernames.length, Math.max(groupSize, 2));
  const requestedGroupCount = Number.parseInt(process.env.PLAYWRIGHT_GROUP_COUNT || `${layout.length}`, 10);
  return layout.slice(0, requestedGroupCount);
}

const groupLayouts = buildGroupLayouts();

function scenarioFlags() {
  const defaults = {
    delayedJoinMs: 0,
    stressRounds: 1,
    refreshDuringLobby: false,
    refreshDuringWaiting: false,
    refreshDuringEditing: false,
    openExtraTabCount: 0,
    closeReopenCount: 0,
    lateOpenCount: 0,
    submitAfterStress: false,
    useLtiLobby: false,
    httpDelayMs: 0,
    httpJitterMs: 0,
    wsReceiveDelayMs: 0,
    wsReceiveJitterMs: 0,
    wsDropYjsUpdates: 0,
  };

  if (scenario === "baseline") {
    return {
      ...defaults,
      submitAfterStress: true,
    };
  }

  if (scenario === "same_user_duplicate") {
    return {
      ...defaults,
      stressRounds: 2,
      refreshDuringEditing: true,
      closeReopenCount: 1,
      lateOpenCount: 1,
      submitAfterStress: true,
    };
  }

  if (scenario === "same_user_blocked") {
    return {
      ...defaults,
      lateOpenCount: 1,
      submitAfterStress: false,
    };
  }

  if (scenario === "lti_lobby") {
    return {
      ...defaults,
      delayedJoinMs: 1000,
      refreshDuringLobby: true,
      submitAfterStress: true,
      useLtiLobby: true,
    };
  }

  if (scenario === "lti_aplus_group") {
    return {
      ...defaults,
      submitAfterStress: false,
    };
  }

  if (scenario === "creator_group_details") {
    return {
      ...defaults,
      submitAfterStress: false,
    };
  }

  if (scenario === "level_tab_switch") {
    return {
      ...defaults,
      submitAfterStress: false,
    };
  }

  if (scenario === "instances_reset") {
    return {
      ...defaults,
      submitAfterStress: false,
    };
  }

  if (scenario === "ws_invalid_rsv1") {
    return {
      ...defaults,
      submitAfterStress: false,
    };
  }

  if (scenario === "ws_recovery") {
    return {
      ...defaults,
      stressRounds: 1,
      submitAfterStress: false,
    };
  }

  if (scenario === "classroom_text_production") {
    return {
      ...defaults,
      delayedJoinMs: 400,
      stressRounds: 1,
      refreshDuringWaiting: false,
      refreshDuringEditing: false,
      openExtraTabCount: 0,
      closeReopenCount: 0,
      lateOpenCount: 0,
      submitAfterStress: false,
      httpDelayMs: 0,
      httpJitterMs: 0,
      wsReceiveDelayMs: 0,
      wsReceiveJitterMs: 0,
      wsDropYjsUpdates: 0,
    };
  }

  if (scenario === "classroom_churn") {
    return {
      ...defaults,
      delayedJoinMs: 600,
      stressRounds: 4,
      refreshDuringWaiting: true,
      refreshDuringEditing: true,
      openExtraTabCount: 2,
      closeReopenCount: 2,
      lateOpenCount: 1,
      submitAfterStress: true,
      httpDelayMs: 100,
      httpJitterMs: 250,
    };
  }

  if (scenario === "duplicate_churn") {
    return {
      ...defaults,
      stressRounds: 4,
      refreshDuringWaiting: true,
      refreshDuringEditing: true,
      openExtraTabCount: 1,
      closeReopenCount: 2,
      lateOpenCount: 1,
      submitAfterStress: true,
      httpDelayMs: 75,
      httpJitterMs: 150,
    };
  }

  if (scenario === "refresh_desync") {
    return {
      ...defaults,
      stressRounds: 1,
      refreshDuringEditing: true,
      submitAfterStress: false,
      httpDelayMs: 100,
      httpJitterMs: 250,
    };
  }

  if (scenario === "in_game_churn") {
    return {
      ...defaults,
      stressRounds: 6,
      refreshDuringEditing: true,
      openExtraTabCount: 2,
      closeReopenCount: 3,
      lateOpenCount: 0,
      submitAfterStress: true,
      httpDelayMs: 100,
      httpJitterMs: 250,
    };
  }

  if (scenario === "in_game_duplicate") {
    return {
      ...defaults,
      stressRounds: 6,
      refreshDuringEditing: true,
      openExtraTabCount: 1,
      closeReopenCount: 3,
      lateOpenCount: 0,
      submitAfterStress: true,
      httpDelayMs: 75,
      httpJitterMs: 200,
    };
  }

  if (scenario === "latency") {
    return {
      ...defaults,
      delayedJoinMs: 1200,
      stressRounds: 2,
      refreshDuringWaiting: true,
      refreshDuringEditing: true,
      openExtraTabCount: 1,
      lateOpenCount: 1,
      submitAfterStress: true,
      httpDelayMs: 200,
      httpJitterMs: 400,
      wsReceiveDelayMs: 150,
      wsReceiveJitterMs: 300,
      wsDropYjsUpdates: 50,
    };
  }

  if (scenario === "prototype_yjs") {
    return {
      ...defaults,
      delayedJoinMs: 1500,
      stressRounds: 3,
      refreshDuringEditing: true,
      openExtraTabCount: 2,
      closeReopenCount: 2,
      lateOpenCount: 1,
      submitAfterStress: false,
    };
  }

  if (scenario === "game_yjs") {
    return {
      ...defaults,
      delayedJoinMs: 1500,
      stressRounds: 3,
      refreshDuringEditing: true,
      openExtraTabCount: 2,
      closeReopenCount: 2,
      lateOpenCount: 1,
      submitAfterStress: false,
    };
  }

  return {
    ...defaults,
    delayedJoinMs: 1500,
    stressRounds: 3,
    refreshDuringWaiting: true,
    refreshDuringEditing: true,
    openExtraTabCount: 2,
    closeReopenCount: 2,
    lateOpenCount: 1,
    submitAfterStress: true,
  };
}

const flags = {
  ...scenarioFlags(),
  delayedJoinMs: Number.parseInt(process.env.PLAYWRIGHT_DELAYED_JOIN_MS || `${scenarioFlags().delayedJoinMs}`, 10),
  stressRounds: Number.parseInt(process.env.PLAYWRIGHT_STRESS_ROUNDS || `${scenarioFlags().stressRounds}`, 10),
  refreshDuringEditing: process.env.PLAYWRIGHT_RELOAD_DURING_EDIT === "true" ? true : scenarioFlags().refreshDuringEditing,
  submitAfterStress: process.env.PLAYWRIGHT_SUBMIT_AFTER_STRESS === "true" ? true : scenarioFlags().submitAfterStress,
  wsReceiveDelayMs: Number.parseInt(process.env.PLAYWRIGHT_WS_RECEIVE_DELAY_MS || `${scenarioFlags().wsReceiveDelayMs}`, 10),
  wsReceiveJitterMs: Number.parseInt(process.env.PLAYWRIGHT_WS_RECEIVE_JITTER_MS || `${scenarioFlags().wsReceiveJitterMs}`, 10),
  wsDropYjsUpdates: Number.parseInt(process.env.PLAYWRIGHT_WS_DROP_YJS_UPDATES || `${scenarioFlags().wsDropYjsUpdates}`, 10),
};

const duplicateUsernames = usernames.filter((username, index) => usernames.indexOf(username) !== index);
if (duplicateUsernames.length > 0) {
  console.log(`identity:duplicate-usernames ${[...new Set(duplicateUsernames)].join("|")}`);
}

function gameUrl(gameId, groupId) {
  if (routeKind === "prototype-yjs") {
    const url = new URL(`/prototype/yjs/${gameId}`, baseUrl);
    if (groupId) {
      url.searchParams.set("groupId", groupId);
    }
    return url.toString();
  }
  const url = new URL(`/game/${gameId}`, baseUrl);
  url.searchParams.set("mode", "game");
  if (groupId) {
    url.searchParams.set("groupId", groupId);
  }
  return url.toString();
}

function getPlaywrightWebSocketUrl() {
  const configuredUrl =
    process.env.PLAYWRIGHT_WEBSOCKET_URL ||
    process.env.PLAYWRIGHT_WS_URL ||
    process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  if (configuredUrl) {
    return configuredUrl.replace("http://", "ws://").replace("https://", "wss://");
  }

  const resolvedBaseUrl = new URL(baseUrl);
  const isLocalhost =
    resolvedBaseUrl.hostname === "localhost" ||
    resolvedBaseUrl.hostname === "127.0.0.1" ||
    resolvedBaseUrl.hostname === "::1";

  if (isLocalhost) {
    return `ws://${resolvedBaseUrl.hostname}:3100`;
  }

  return `${resolvedBaseUrl.protocol === "https:" ? "wss:" : "ws:"}//${resolvedBaseUrl.host}/hello-ui-ws`;
}

function getHealthUrlForWebSocket(wsUrl) {
  const resolvedWsUrl = new URL(wsUrl);
  resolvedWsUrl.protocol = resolvedWsUrl.protocol === "wss:" ? "https:" : "http:";
  resolvedWsUrl.pathname = "/health";
  resolvedWsUrl.search = "";
  resolvedWsUrl.hash = "";
  return resolvedWsUrl.toString();
}

function buildLocalPlaywrightWebSocketUrl(port) {
  const resolvedBaseUrl = new URL(baseUrl);
  const protocol = resolvedBaseUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${resolvedBaseUrl.hostname}:${port}`;
}

async function getAvailablePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate a temporary WS port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function fetchHealthOk(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealthState(url, expectedOk, timeoutMs) {
  const startedAt = Date.now();
  let lastValue = false;
  while (Date.now() - startedAt < timeoutMs) {
    lastValue = await fetchHealthOk(url);
    if (lastValue === expectedOk) {
      return lastValue;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return lastValue;
}

function buildMaskedTextFrame(payload, { rsv1 = false } = {}) {
  const payloadBuffer = Buffer.from(payload, "utf8");
  if (payloadBuffer.length > 125) {
    throw new Error("Malformed frame helper only supports small payloads.");
  }

  const mask = randomBytes(4);
  const frame = Buffer.alloc(2 + 4 + payloadBuffer.length);
  frame[0] = 0x80 | (rsv1 ? 0x40 : 0x00) | 0x01;
  frame[1] = 0x80 | payloadBuffer.length;
  mask.copy(frame, 2);
  for (let index = 0; index < payloadBuffer.length; index += 1) {
    frame[6 + index] = payloadBuffer[index] ^ mask[index % 4];
  }
  return frame;
}

// Browsers cannot craft invalid RSV bits, so this diagnostic path performs a valid
// upgrade and then injects one malformed client frame to reproduce the prod crash.
async function sendMalformedRsv1Frame(targetWsUrl) {
  const resolvedUrl = new URL(targetWsUrl);
  const port =
    resolvedUrl.port
      ? Number.parseInt(resolvedUrl.port, 10)
      : resolvedUrl.protocol === "wss:"
        ? 443
        : 80;
  const pathWithQuery = `${resolvedUrl.pathname || "/"}${resolvedUrl.search || ""}`;
  const upgradeKey = randomBytes(16).toString("base64");
  const originProtocol = resolvedUrl.protocol === "wss:" ? "https:" : "http:";

  return await new Promise((resolve, reject) => {
    const client = resolvedUrl.protocol === "wss:"
      ? tls.connect({ host: resolvedUrl.hostname, port, servername: resolvedUrl.hostname })
      : net.createConnection({ host: resolvedUrl.hostname, port });
    let handshakeComplete = false;
    let responseBuffer = "";
    let settled = false;
    let lastError = null;

    const settle = (value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    };

    const timeoutId = setTimeout(() => {
      fail(new Error(`Timed out while sending malformed RSV1 frame to ${targetWsUrl}`));
    }, scaledTimeout(10000));

    client.on("connect", () => {
      client.write(
        [
          `GET ${pathWithQuery || "/"} HTTP/1.1`,
          `Host: ${resolvedUrl.host}`,
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Origin: ${originProtocol}//${resolvedUrl.host}`,
          `Sec-WebSocket-Key: ${upgradeKey}`,
          "Sec-WebSocket-Version: 13",
          "\r\n",
        ].join("\r\n"),
      );
    });

    client.on("data", (chunk) => {
      if (handshakeComplete) {
        return;
      }

      responseBuffer += chunk.toString("latin1");
      if (!responseBuffer.includes("\r\n\r\n")) {
        return;
      }

      const firstLine = responseBuffer.split("\r\n", 1)[0] || "";
      if (!firstLine.includes("101")) {
        fail(new Error(`WebSocket upgrade failed: ${firstLine}`));
        return;
      }

      handshakeComplete = true;
      client.write(buildMaskedTextFrame("pw-invalid-rsv1", { rsv1: true }));
      setTimeout(() => {
        settle({
          handshakeComplete,
          lastError: lastError?.message || null,
        });
        client.destroy();
      }, 500);
    });

    client.on("error", (error) => {
      lastError = error;
      if (!handshakeComplete) {
        fail(error);
      }
    });

    client.on("close", (hadError) => {
      settle({
        handshakeComplete,
        lastError: lastError?.message || null,
        hadError,
      });
    });
  });
}

async function runInvalidRsv1Scenario() {
  if (process.env.PLAYWRIGHT_ALLOW_WS_CRASH !== "true") {
    throw new Error(
      "ws_invalid_rsv1 sends malformed frames to verify WS crash hardening. Re-run with PLAYWRIGHT_ALLOW_WS_CRASH=true.",
    );
  }

  const wsUrl = getPlaywrightWebSocketUrl();
  const healthUrl = getHealthUrlForWebSocket(wsUrl);
  const expectCrash = process.env.PLAYWRIGHT_EXPECT_WS_CRASH === "true";

  const healthyBefore = await waitForHealthState(healthUrl, true, scaledTimeout(5000));
  expect(healthyBefore).toBe(true);

  console.log(`ws-invalid-frame target=${wsUrl}`);
  console.log(`ws-invalid-frame health=${healthUrl}`);

  const result = await sendMalformedRsv1Frame(wsUrl);
  expect(result.handshakeComplete).toBe(true);

  const healthAfter = await waitForHealthState(
    healthUrl,
    expectCrash ? false : true,
    scaledTimeout(5000),
  );

  console.log(
    `ws-invalid-frame handshake=${result.handshakeComplete} error=${result.lastError || "none"} crashed=${!healthAfter}`,
  );

  if (expectCrash) {
    expect(healthAfter).toBe(false);
  } else {
    expect(healthAfter).toBe(true);
  }

  console.log("");
  console.log(`Playwright scenario: ${scenario}`);
  console.log(`Summary`);
  console.log(`ws-invalid-frame | ${expectCrash ? "EXPECT_CRASH" : "EXPECT_SURVIVE"} | ${healthAfter ? "HEALTHY" : "DOWN"}`);

  const passed = expectCrash ? !healthAfter : healthAfter;
  printRunSummary(scenario, passed, {
    "handshake-complete": result.handshakeComplete,
    [`health-${expectCrash ? "down" : "up"}`]: passed,
  });
}

async function applyPlaywrightWebSocketOverride(context, wsUrl) {
  await context.addInitScript((overrideWsUrl) => {
    window.__PLAYWRIGHT_WEBSOCKET_URL__ = overrideWsUrl;
    try {
      window.sessionStorage.setItem("__PLAYWRIGHT_WEBSOCKET_URL__", overrideWsUrl);
    } catch {
      // Ignore storage failures in hardened browser contexts.
    }
  }, wsUrl);
}

async function startManagedWsServer(envOverrides = {}) {
  const child = spawn(process.execPath, ["ws-server/server.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    const lines = chunk.toString("utf8").trim().split("\n").filter(Boolean);
    for (const line of lines) {
      console.log(`[managed-ws] ${line}`);
    }
  });
  child.stderr.on("data", (chunk) => {
    const lines = chunk.toString("utf8").trim().split("\n").filter(Boolean);
    for (const line of lines) {
      console.warn(`[managed-ws:stderr] ${line}`);
    }
  });

  return child;
}

function startDetachedWsServer() {
  const child = spawn(process.execPath, ["ws-server/server.mjs"], {
    cwd: process.cwd(),
    env: process.env,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

async function stopManagedWsServer(child) {
  if (!child || child.exitCode != null) {
    return;
  }

  await new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, scaledTimeout(3000));

    child.once("exit", () => {
      clearTimeout(timeoutId);
      resolve();
    });

    child.kill("SIGTERM");
  });
}

async function findListeningPids(port) {
  try {
    const { stdout } = await execFileAsync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      cwd: process.cwd(),
    });
    return stdout
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch (error) {
    if (typeof error?.code === "number" && error.code === 1) {
      return [];
    }
    throw error;
  }
}

async function terminatePids(pids) {
  for (const pid of pids) {
    if (pid === process.pid) {
      continue;
    }
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore already-exited processes.
    }
  }
}

async function waitForReconnectRecovery(pages, marker, timeoutMs) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const replicated = await trySharedEdit(pages, marker);
      if (replicated) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }
    await pages[0].waitForTimeout(1000);
  }

  if (lastError) {
    throw lastError;
  }
  return false;
}

async function runWsRecoveryScenario(browser) {
  if (process.env.PLAYWRIGHT_ALLOW_WS_CRASH !== "true") {
    throw new Error(
      "ws_recovery intentionally restarts the current WS server. Re-run with PLAYWRIGHT_ALLOW_WS_CRASH=true.",
    );
  }

  const restartDelayMs = Number.parseInt(process.env.PLAYWRIGHT_WS_RESTART_DELAY_MS || "1000", 10);
  const reconnectWindowMs = Number.parseInt(process.env.PLAYWRIGHT_WS_RECONNECT_WINDOW_MS || "30000", 10);
  const postStressRounds = Number.parseInt(process.env.PLAYWRIGHT_WS_RECOVERY_POST_STRESS_ROUNDS || "1", 10);
  const postRestoreSettleMs = Number.parseInt(process.env.PLAYWRIGHT_WS_POST_RESTORE_SETTLE_MS || "5000", 10);
  const extraReload = process.env.PLAYWRIGHT_WS_RECOVERY_EXTRA_RELOAD === "true";
  const verifyStability = process.env.PLAYWRIGHT_WS_RECOVERY_VERIFY_STABILITY === "true";
  const isolateWsServer = process.env.PLAYWRIGHT_WS_ISOLATE !== "false";
  const originalPlaywrightWebSocketUrl = process.env.PLAYWRIGHT_WEBSOCKET_URL;
  const originalPlaywrightWsUrl = process.env.PLAYWRIGHT_WS_URL;
  let wsUrl = getPlaywrightWebSocketUrl();
  if (isolateWsServer) {
    const isolatedPort = await getAvailablePort();
    wsUrl = buildLocalPlaywrightWebSocketUrl(isolatedPort);
    process.env.PLAYWRIGHT_WEBSOCKET_URL = wsUrl;
    process.env.PLAYWRIGHT_WS_URL = wsUrl;
  }
  const healthUrl = getHealthUrlForWebSocket(wsUrl);
  const wsPort = Number.parseInt(new URL(wsUrl).port || "3100", 10);
  let managedWsChild = null;
  let shouldRestoreDetachedWs = false;

  const contexts = [];

  try {
    if (isolateWsServer) {
      managedWsChild = await startManagedWsServer({ PORT: String(wsPort) });
      const isolatedHealthy = await waitForHealthState(healthUrl, true, scaledTimeout(5000));
      expect(isolatedHealthy).toBe(true);
    }

    for (const username of usernames) {
      const context = await browser.newContext({ baseURL: baseUrl, viewport: smokeViewport });
      await applyPlaywrightWebSocketOverride(context, wsUrl);
      await enableHttpLatency(context);
      const page = await context.newPage();
      await enableWsReceiveDelay(page);
      await configureConsoleLogging(page, username);
      contexts.push({ username, context, page, extraPages: [] });
      await signInDevUser(page, username);
      console.log(`signed in ${username}`);
    }

    const creator = contexts[0];
    const createdGame = await createPlayableGroupGame(creator.context.request, creator.username);
    activeGameId = createdGame.gameId;
    const group = {
      groupId: createdGame.groupId,
      groupName: createdGame.groupName,
      joinKey: createdGame.joinKey,
      memberIndexes: groupLayouts[0],
      ownerIndex: groupLayouts[0][0],
    };

    for (const memberIndex of group.memberIndexes.slice(1)) {
      const participant = contexts[memberIndex];
      await joinGroup(participant.context.request, group.groupId, group.joinKey, participant.username);
      console.log(`joined ${participant.username} -> ${group.groupId}`);
    }

    for (const memberIndex of group.memberIndexes) {
      const participant = contexts[memberIndex];
      await gotoGamePage(participant.page, gameUrl(activeGameId, group.groupId), `group-open:${participant.username}`);
    }

    const pages = group.memberIndexes.map((memberIndex) => contexts[memberIndex].page);
    await startGroupGame(pages);
    await waitForEditorOnPages(pages);

    const beforeMarker = `pw-before-crash-${Date.now().toString(36)}`;
    const beforeCrashOk = await trySharedEdit(pages, beforeMarker);
    console.log(`ws-recovery beforeCrashOk=${beforeCrashOk}`);
    expect(beforeCrashOk).toBe(true);

    const healthyBefore = await waitForHealthState(healthUrl, true, scaledTimeout(5000));
    expect(healthyBefore).toBe(true);

    if (isolateWsServer) {
      expect(managedWsChild).not.toBe(null);
      console.log(`ws-recovery stopping isolatedPort=${wsPort}`);
      await stopManagedWsServer(managedWsChild);
      managedWsChild = null;
    } else {
      const listeningPids = await findListeningPids(wsPort);
      expect(listeningPids.length > 0).toBe(true);
      console.log(`ws-recovery stopping pids=${listeningPids.join(",")}`);
      shouldRestoreDetachedWs = listeningPids.length > 0;
      await terminatePids(listeningPids);
    }
    const crashed = await waitForHealthState(healthUrl, false, scaledTimeout(5000));
    expect(crashed).toBe(false);
    console.log(`ws-recovery crashed=true restartDelayMs=${restartDelayMs}`);

    await new Promise((resolve) => setTimeout(resolve, restartDelayMs));
    managedWsChild = await startManagedWsServer(isolateWsServer ? { PORT: String(wsPort) } : {});

    const healthyAfterRestart = await waitForHealthState(healthUrl, true, scaledTimeout(5000));
    expect(healthyAfterRestart).toBe(true);
    console.log("ws-recovery restarted=true");

    const afterMarker = `pw-after-restart-${Date.now().toString(36)}`;
    const recovered = await waitForReconnectRecovery(pages, afterMarker, reconnectWindowMs);
    console.log(`ws-recovery recovered=${recovered} reconnectWindowMs=${reconnectWindowMs}`);
    expect(recovered).toBe(true);

    const requiredMarkers = [beforeMarker, afterMarker];
    const convergenceAfterRestart = await waitForPagesConverged(
      pages,
      requiredMarkers,
      "ws-recovery:post-restart",
      reconnectWindowMs,
    );
    console.log(
      `ws-recovery convergedAfterRestart=${convergenceAfterRestart.ok} lengths=${convergenceAfterRestart.contents.map((content) => content.length).join("|")}`
    );
    expect(convergenceAfterRestart.ok).toBe(true);

    for (let round = 1; round <= postStressRounds; round += 1) {
      const sourceOffset = round % pages.length;
      const orderedPages = pages.slice(sourceOffset).concat(pages.slice(0, sourceOffset));
      const marker = `pw-recovery-round-${round}-${Date.now().toString(36)}`;
      const replicated = await trySharedEdit(orderedPages, marker);
      console.log(`ws-recovery round=${round} sharedEdit=${replicated} marker=${marker}`);
      expect(replicated).toBe(true);

      const sharedConvergence = await waitForPagesConverged(
        pages,
        [marker],
        `ws-recovery:round-${round}:shared`,
        scaledTimeout(15000),
      );
      console.log(
        `ws-recovery round=${round} sharedConverged=${sharedConvergence.ok} lengths=${sharedConvergence.contents.map((content) => content.length).join("|")}`
      );
      expect(sharedConvergence.ok).toBe(true);

      const concurrentOk = await tryConcurrentSharedEdit(pages, `ws-recovery-round-${round}`);
      console.log(`ws-recovery round=${round} concurrentOk=${concurrentOk}`);
      expect(concurrentOk).toBe(true);

      const samePositionOk = await trySamePositionConcurrentEdit(pages, `ws-recovery-round-${round}-same-position`);
      console.log(`ws-recovery round=${round} samePositionOk=${samePositionOk}`);
      expect(samePositionOk).toBe(true);

      const roundConvergence = await waitForPagesConverged(
        pages,
        [],
        `ws-recovery:round-${round}`,
        scaledTimeout(15000),
      );
      console.log(
        `ws-recovery round=${round} converged=${roundConvergence.ok} lengths=${roundConvergence.contents.map((content) => content.length).join("|")}`
      );
      expect(roundConvergence.ok).toBe(true);

      const roundSettled = await waitForEditorsSettled(
        pages,
        `ws-recovery:round-${round}:settled`,
        scaledTimeout(12000),
      );
      console.log(`ws-recovery round=${round} settled=${roundSettled}`);
      expect(roundSettled).toBe(true);
    }

    if (verifyStability) {
      if (flags.wsReceiveDelayMs <= 0 && flags.wsDropYjsUpdates <= 0) {
        throw new Error(
          "PLAYWRIGHT_WS_RECOVERY_VERIFY_STABILITY=true requires PLAYWRIGHT_WS_RECEIVE_DELAY_MS or PLAYWRIGHT_WS_DROP_YJS_UPDATES.",
        );
      }
      const stabilityReady = await waitForEditorsSettled(
        pages,
        "ws-recovery:stability-ready",
        scaledTimeout(12000),
      );
      console.log(`ws-recovery stabilityReady=${stabilityReady}`);
      expect(stabilityReady).toBe(true);
      try {
        const stabilityResult = await tryEditStability(pages[0], pages, "ws-recovery-post", { droppingPage: pages[0] });
        console.log(
          `ws-recovery stability stable=${stabilityResult.stable} convergedToPeers=${stabilityResult.convergedToPeers} appearedAt=${stabilityResult.appearedAt} disappearedAt=${stabilityResult.disappearedAt}`
        );
        expect(stabilityResult.stable).toBe(true);
      } finally {
        stopDroppingYjsUpdates(pages[0]);
      }
    }

    if (extraReload) {
      const reloadPage = pages[pages.length - 1];
      await reloadGamePage(reloadPage, "ws-recovery:post-restart");
      await waitForEditorOnPage(reloadPage, "ws-recovery:post-restart");

      const reloadMarker = `pw-recovery-reload-${Date.now().toString(36)}`;
      const reloadOrderedPages = [reloadPage, ...pages.filter((page) => page !== reloadPage)];
      const reloadReplicated = await trySharedEdit(reloadOrderedPages, reloadMarker);
      console.log(`ws-recovery postReload sharedEdit=${reloadReplicated} marker=${reloadMarker}`);
      expect(reloadReplicated).toBe(true);

      const convergenceAfterReload = await waitForPagesConverged(
        pages,
        [reloadMarker],
        "ws-recovery:post-reload",
        scaledTimeout(15000),
      );
      console.log(
        `ws-recovery postReload converged=${convergenceAfterReload.ok} lengths=${convergenceAfterReload.contents.map((content) => content.length).join("|")}`
      );
      expect(convergenceAfterReload.ok).toBe(true);
    }

    console.log("");
    console.log(`Playwright scenario: ${scenario}`);
    console.log("Summary");
    console.log(
      `ws-recovery | ${recovered ? "RECOVERED" : "FAILED"} | restartDelayMs=${restartDelayMs} postStressRounds=${postStressRounds} extraReload=${extraReload} verifyStability=${verifyStability}`
    );
    printRunSummary(scenario, recovered, {
      "ws-recovered": recovered,
    }, { restartDelayMs, postStressRounds, extraReload, verifyStability });
  } finally {
    await stopManagedWsServer(managedWsChild);
    if (shouldRestoreDetachedWs) {
      startDetachedWsServer();
      await waitForHealthState(healthUrl, true, scaledTimeout(5000)).catch(() => false);
      if (postRestoreSettleMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, postRestoreSettleMs));
      }
    }
    if (originalPlaywrightWebSocketUrl === undefined) {
      delete process.env.PLAYWRIGHT_WEBSOCKET_URL;
    } else {
      process.env.PLAYWRIGHT_WEBSOCKET_URL = originalPlaywrightWebSocketUrl;
    }
    if (originalPlaywrightWsUrl === undefined) {
      delete process.env.PLAYWRIGHT_WS_URL;
    } else {
      process.env.PLAYWRIGHT_WS_URL = originalPlaywrightWsUrl;
    }
    await Promise.all(contexts.flatMap(({ extraPages = [] }) => extraPages).map(async (page) => page.close().catch(() => {})));
    await Promise.all(contexts.map(async ({ context }) => context.close().catch(() => {})));
  }
}

async function runRefreshDesyncScenario(browser) {
  const contexts = [];

  try {
    for (const username of usernames) {
      const context = await browser.newContext({ baseURL: baseUrl, viewport: smokeViewport });
      await enableHttpLatency(context);
      const page = await context.newPage();
      await enableWsReceiveDelay(page);
      await configureConsoleLogging(page, username);
      contexts.push({ username, context, page, extraPages: [] });
      await signInDevUser(page, username);
      console.log(`signed in ${username}`);
    }

    const creator = contexts[0];
    const createdGame = await createPlayableGroupGame(creator.context.request, creator.username);
    activeGameId = createdGame.gameId;
    const group = {
      groupId: createdGame.groupId,
      groupName: createdGame.groupName,
      joinKey: createdGame.joinKey,
      memberIndexes: [0, 1],
      ownerIndex: 0,
    };

    await joinGroup(contexts[1].context.request, group.groupId, group.joinKey, contexts[1].username);
    console.log(`joined ${contexts[1].username} -> ${group.groupId}`);

    for (const memberIndex of group.memberIndexes) {
      await gotoGamePage(contexts[memberIndex].page, gameUrl(activeGameId, group.groupId), `group-open:${contexts[memberIndex].username}`);
    }

    const pages = group.memberIndexes.map((memberIndex) => contexts[memberIndex].page);
    await startGroupGame(pages);
    await waitForEditorOnPages(pages);

    const baselineMarker = `pw-refresh-baseline-${Date.now().toString(36)}`;
    const baselineOk = await trySharedEdit([pages[0], pages[1]], baselineMarker);
    console.log(`refresh-desync baselineOk=${baselineOk} marker=${baselineMarker}`);
    expect(baselineOk).toBe(true);

    const beforeReloadContents = await Promise.all(pages.map((page) => getEditableContent(page)));
    console.log(`refresh-desync beforeReloadLengths=${beforeReloadContents.map((content) => content.length).join("|")}`);

    const duringReloadMarker = `pw-during-reload-${Date.now().toString(36)}`;
    const slowTypePromise = typeMarkerSlowly(pages[0], duringReloadMarker);
    await pages[1].waitForTimeout(120);
    await reloadGamePage(pages[1], `refresh-desync:${contexts[1].username}`);
    await waitForEditorOnPage(pages[1], `refresh-desync:${contexts[1].username}`);
    await slowTypePromise;

    const afterReloadContent = await getEditableContent(pages[1]);
    console.log(`refresh-desync afterReloadLength=${afterReloadContent.length}`);

    const reloadedCaughtDuringReload = await waitForMarkerOnPage(
      pages[1],
      duringReloadMarker,
      `${group.groupName}:reloaded-caught-during-reload`,
    );
    console.log(`refresh-desync reloadedCaughtDuringReload=${reloadedCaughtDuringReload} marker=${duringReloadMarker}`);
    expect(reloadedCaughtDuringReload).toBe(true);

    const remoteAfterRefreshMarker = `pw-from-user01-after-refresh-${Date.now().toString(36)}`;
    const originalToReloadedOk = await trySharedEdit([pages[0], pages[1]], remoteAfterRefreshMarker);
    console.log(`refresh-desync originalToReloadedOk=${originalToReloadedOk} marker=${remoteAfterRefreshMarker}`);
    expect(originalToReloadedOk).toBe(true);

    const reloadedReceivesRemote = await waitForMarkerOnPage(
      pages[1],
      remoteAfterRefreshMarker,
      `${group.groupName}:reloaded-receives-remote`,
    );
    console.log(`refresh-desync reloadedReceivesRemote=${reloadedReceivesRemote}`);
    expect(reloadedReceivesRemote).toBe(true);

    const outboundAfterRefreshMarker = `pw-from-user02-after-refresh-${Date.now().toString(36)}`;
    const reloadedToOriginalOk = await trySharedEdit([pages[1], pages[0]], outboundAfterRefreshMarker);
    console.log(`refresh-desync reloadedToOriginalOk=${reloadedToOriginalOk} marker=${outboundAfterRefreshMarker}`);
    expect(reloadedToOriginalOk).toBe(true);

    const originalReceivesReloaded = await waitForMarkerOnPage(
      pages[0],
      outboundAfterRefreshMarker,
      `${group.groupName}:original-receives-reloaded`,
    );
    console.log(`refresh-desync originalReceivesReloaded=${originalReceivesReloaded}`);
    expect(originalReceivesReloaded).toBe(true);

    const convergence = await waitForPagesConverged(
      pages,
      [],
      group.groupName,
      scaledTimeout(15000),
    );
    console.log(`refresh-desync converged=${convergence.ok}`);
    expect(convergence.ok).toBe(true);

    console.log("");
    console.log(`Playwright scenario: ${scenario}`);
    console.log(`Game: ${activeGameId}`);
    console.log("Summary");
    console.log(
      `refresh-desync | ${convergence.ok ? "PASS" : "FAIL"} | ` +
      `baseline=${baselineOk} duringReload=${reloadedCaughtDuringReload} originalToReloaded=${originalToReloadedOk} reloadedToOriginal=${reloadedToOriginalOk}`,
    );
    const allPassed = baselineOk && originalToReloadedOk && reloadedToOriginalOk && convergence.ok;
    printRunSummary(scenario, allPassed, {
      baseline: baselineOk,
      "original-to-reloaded": originalToReloadedOk,
      "reloaded-to-original": reloadedToOriginalOk,
      convergence: convergence.ok,
    });
  } finally {
    await Promise.all(contexts.flatMap(({ extraPages = [] }) => extraPages).map(async (page) => page.close().catch(() => {})));
    await Promise.all(contexts.map(async ({ context }) => context.close().catch(() => {})));
  }
}

function normalizeName(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const localEmailMatch = normalized.match(/^dev\+([a-z0-9_-]+)@local\.test$/);
  if (localEmailMatch) {
    return localEmailMatch[1];
  }
  const localDisplayMatch = normalized.match(/^user(\d+)$/);
  if (localDisplayMatch) {
    return `user${localDisplayMatch[1].padStart(2, "0")}`;
  }
  return normalized;
}

function resolveBrowserType(name) {
  if (name === "firefox") {
    return firefox;
  }
  if (name === "webkit") {
    return webkit;
  }
  return chromium;
}

function expectedLtiDisplayName(username, index) {
  const numericId = index + 1;
  const given = username.replace(/^user/i, "User ");
  const family = `Lti${String(numericId).padStart(2, "0")}`;
  return `${given} ${family}`;
}

function createStarterLevel() {
  return {
    name: "template",
    scenarios: [],
    buildingBlocks: { pictures: [], colors: [] },
    code: {
      html: "<main>\n  <h1>Playwright Group Test</h1>\n  <p>Edit this text from any user.</p>\n</main>",
      css: "main { font-family: sans-serif; padding: 24px; }\nh1 { color: #14532d; }",
      js: "",
    },
    solution: { html: "", css: "", js: "" },
    accuracy: 0,
    week: "playwright-local",
    percentageTreshold: 70,
    percentageFullPointsTreshold: 95,
    pointsThresholds: [
      { accuracy: 70, pointsPercent: 25 },
      { accuracy: 85, pointsPercent: 60 },
      { accuracy: 95, pointsPercent: 100 },
    ],
    difficulty: "easy",
    instructions: [],
    question_and_answer: { question: "", answer: "" },
    help: { description: "Start coding!", images: [], usefullCSSProperties: [] },
    timeData: { startTime: 0, pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" } },
    events: [],
    interactive: false,
    showScenarioModel: true,
    showHotkeys: false,
    showSolutionImageInsteadOfDiff: true,
    lockCSS: false,
    lockHTML: false,
    lockJS: false,
    completed: "",
    points: 0,
    maxPoints: 100,
    confettiSprinkled: false,
  };
}

function createLevelFixture(name, htmlText, cssText, jsText = "") {
  const level = createStarterLevel();
  return {
    ...level,
    name,
    code: {
      html: htmlText,
      css: cssText,
      js: jsText,
    },
  };
}

function createLtiSession(username, gameId) {
  return {
    userId: `dev-${username}`,
    userEmail: `dev+${username}@local.test`,
    userName: username,
    groupId: null,
    groupName: "Playwright Course",
    groupResolution: "pending",
    role: "member",
    documentTarget: "iframe",
    returnUrl: `${baseUrl}/courses/playwright`,
    ltiData: {
      context_id: `playwright-course-${gameId}`,
      context_title: "Playwright Course",
      resource_link_id: gameId,
      user_id: username,
      roles: "Learner",
    },
  };
}

function summarizeSet(values) {
  return [...new Set(values.filter(Boolean).map(normalizeName))].sort();
}

async function signInDevUser(page, username) {
  await page.goto(new URL("/auth/signin", baseUrl).toString(), { waitUntil: "networkidle" });

  const signInResult = await page.evaluate(async (nextUsername) => {
    const csrfResponse = await fetch("/api/auth/csrf", { credentials: "include" });
    const csrfPayload = await csrfResponse.json();
    const params = new URLSearchParams({
      csrfToken: csrfPayload.csrfToken,
      username: nextUsername,
      callbackUrl: "/",
      json: "true",
    });
    const response = await fetch("/api/auth/callback/dev-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      credentials: "include",
    });

    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
    };
  }, normalizeName(username));

  if (!signInResult.ok) {
    throw new Error(
      `Local dev sign-in failed for ${username}: ${signInResult.status} ${signInResult.text}`,
    );
  }

  await expect
    .poll(async () => {
      return page.evaluate(async () => {
        const response = await fetch("/api/auth/session", { credentials: "include" });
        const session = await response.json();
        return Boolean(session?.user?.email);
      });
    }, {
      timeout: scaledTimeout(15000),
      message: `Expected authenticated session for ${username}`,
    })
    .toBe(true);

  // Pre-acknowledge all tour spots so the Joyride overlay never blocks interactions.
  await page.evaluate(async (acks) => {
    await fetch("/api/user/tour-spots", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acks }),
    }).catch(() => {});
  }, TOUR_SPOT_ACKS);
}

async function enableHttpLatency(context) {
  if (flags.httpDelayMs <= 0 && flags.httpJitterMs <= 0) {
    return;
  }

  await context.route("**/*", async (route) => {
    const url = route.request().url();
    const isTarget =
      url.includes("/api/") ||
      url.includes(`/game/`) ||
      url.includes("/auth/signin");
    if (isTarget) {
      const jitter = flags.httpJitterMs > 0 ? Math.floor(Math.random() * flags.httpJitterMs) : 0;
      await new Promise((resolve) => setTimeout(resolve, flags.httpDelayMs + jitter));
    }
    await route.continue();
  });
}

// ---------------------------------------------------------------------------
// WS receive-delay via Playwright's routeWebSocket
// ---------------------------------------------------------------------------
// Intercepts browser WebSocket connections at the Playwright level and delays
// server→client messages, simulating production latency. This is the critical
// path that triggers desync when the client creates an empty Y.Doc and the
// server SyncStep2 response arrives late.
//
// When wsDropYjsUpdateCount > 0, the first N Yjs update messages from the
// server are silently dropped to force a real content divergence between
// clients, triggering the server-side health check → divergence_detected →
// client recovery path. Pre-fix code creates an empty Y.Doc during recovery
// which (with receive delay) cascades into a recovery loop / text erasure.
// ---------------------------------------------------------------------------

// Per-page drop control: test code can call startDroppingYjsUpdates(page)
// to begin dropping server→client Yjs messages, and stopDroppingYjsUpdates(page)
// to stop. This allows dropping to start only after the editor is fully loaded.
const pageDropState = new WeakMap();

function startDroppingYjsUpdates(page) {
  const state = pageDropState.get(page);
  if (state) state.dropping = true;
}

function stopDroppingYjsUpdates(page) {
  const state = pageDropState.get(page);
  if (state) state.dropping = false;
}

async function enableWsReceiveDelay(page) {
  const delayMs = flags.wsReceiveDelayMs;
  const jitterMs = flags.wsReceiveJitterMs;
  const hasDrops = flags.wsDropYjsUpdates > 0;
  const forceWsRoute = scenario === "classroom_text_production";
  if (delayMs <= 0 && jitterMs <= 0 && !hasDrops && !forceWsRoute) return;

  const dropState = { dropping: false, count: 0 };
  pageDropState.set(page, dropState);

  const wsUrl = getPlaywrightWebSocketUrl();
  const wsOrigin = new URL(wsUrl).origin.replace("http", "ws");

  await page.routeWebSocket(`${wsOrigin}/**`, (ws) => {
    const server = ws.connectToServer();

    // Client → server: forward immediately
    ws.onMessage((message) => {
      server.send(message);
    });

    // Server → client: optionally drop + delay
    server.onMessage((message) => {
      // Drop Yjs updates when dropping is active to force divergence
      if (dropState.dropping && typeof message === "string") {
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === "yjs-protocol" || parsed.type === "yjs-update") {
            dropState.count++;
            return; // silently drop
          }
        } catch {}
      }

      const jitter = jitterMs > 0 ? Math.floor(Math.random() * jitterMs) : 0;
      const totalDelay = delayMs + jitter;
      if (totalDelay <= 0) {
        ws.send(message);
        return;
      }
      setTimeout(() => {
        ws.send(message);
      }, totalDelay);
    });
  });
}

async function createGroup(request, creatorUsername, gameId, suffix = "group") {
  const groupName = `pw-${creatorUsername}-${suffix}-${Date.now().toString(36)}`;
  const createResponse = await request.post(`${baseUrl}/api/groups`, {
    data: {
      name: groupName,
      resourceLinkId: gameId,
    },
  });
  if (!createResponse.ok()) {
    throw new Error(`Failed to create group: ${createResponse.status()} ${await createResponse.text()}`);
  }
  const createPayload = await createResponse.json();
  const groupId = createPayload.group?.id;
  if (!groupId) {
    throw new Error("Group create response did not include a group id.");
  }
  const detailsResponse = await request.get(`${baseUrl}/api/groups/${groupId}`);
  if (!detailsResponse.ok()) {
    throw new Error(`Failed to fetch created group ${groupId}: ${detailsResponse.status()} ${await detailsResponse.text()}`);
  }
  const detailsPayload = await detailsResponse.json();
  const joinKey = detailsPayload.group?.joinKey;
  if (!joinKey) {
    throw new Error(`Group ${groupId} did not expose a join key.`);
  }
  return { groupId, groupName, joinKey };
}

async function joinGroup(request, groupId, joinKey, username) {
  const response = await request.post(`${baseUrl}/api/groups/${groupId}/members`, {
    data: { joinKey },
  });
  if (!response.ok()) {
    throw new Error(`Failed to join group for ${username}: ${response.status()} ${await response.text()}`);
  }
}

async function fetchGroupSnapshot(request, group) {
  const response = await request.get(`${baseUrl}/api/groups/${group.groupId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch group snapshot for ${group.groupName}: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  return {
    groupId: group.groupId,
    name: payload.group?.name ?? group.groupName,
    joinKey: payload.group?.joinKey ?? group.joinKey,
    memberNames: Array.isArray(payload.members)
      ? payload.members.map((member) => member.userName || member.userEmail || member.userId || "unknown")
      : [],
    memberCount: Array.isArray(payload.members) ? payload.members.length : 0,
  };
}

async function fetchGameGroupsSnapshot(request) {
  const response = await request.get(`${baseUrl}/api/games/${activeGameId}/groups`);
  if (!response.ok) {
    throw new Error(`Failed to fetch game groups snapshot: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  return Array.isArray(payload.groups) ? payload.groups : [];
}

async function resolveSharedInstance(request, username, groupId) {
  const response = await request.get(
    `${baseUrl}/api/games/${activeGameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
  );
  if (!response.ok()) {
    throw new Error(`Failed to resolve group instance for ${username}: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  return payload.instance?.id ?? null;
}

async function seedGroupInstance(request, gameId, groupId, label) {
  const seedResponse = await request.patch(
    `${baseUrl}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
    {
      data: {
        progressData: {
          levels: [createStarterLevel()],
          testGroupLabel: label,
        },
      },
    },
  );
  if (!seedResponse.ok()) {
    throw new Error(`Failed to seed starter level for group ${groupId}: ${seedResponse.status()} ${await seedResponse.text()}`);
  }
}

async function createTemplateLevel(request, label) {
  const starterLevel = createStarterLevel();
  const response = await request.post(`${baseUrl}/api/levels`, {
    data: {
      ...starterLevel,
      name: `Playwright Template ${label}`,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create template level: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  if (!payload.identifier) {
    throw new Error("Template level create response did not include an identifier.");
  }
  return payload.identifier;
}

async function createTemplateLevelFromFixture(request, label, fixture) {
  const response = await request.post(`${baseUrl}/api/levels`, {
    data: {
      ...fixture,
      name: `${fixture.name} ${label}`,
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create template level: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  if (!payload.identifier) {
    throw new Error("Template level create response did not include an identifier.");
  }
  return payload.identifier;
}

async function attachLevelToMap(request, mapName, levelIdentifier) {
  const response = await request.post(`${baseUrl}/api/maps/levels/${encodeURIComponent(mapName)}`, {
    data: {
      levels: [levelIdentifier],
    },
  });
  if (!response.ok()) {
    throw new Error(`Failed to attach level ${levelIdentifier} to map ${mapName}: ${response.status()} ${await response.text()}`);
  }
}

async function createPlayableGroupGame(request, creatorUsername) {
  const { gameId, mapName, title } = await createGroupModeGame(request, creatorUsername);
  const group = await createGroup(request, creatorUsername, gameId, "group-a");
  await seedGroupInstance(request, gameId, group.groupId, "group-a");

  return { gameId, mapName, title, ...group };
}

async function createPlayableTwoLevelGroupGame(request, creatorUsername) {
  const { gameId, mapName, title } = await createGroupModeGame(request, creatorUsername);
  const levelOne = createLevelFixture(
    "Level One",
    "<main>\n  <h1>Level One</h1>\n  <p>HTML marker should stay here.</p>\n</main>",
    "main { color: #14532d; }\n/* level one css */",
  );
  const levelTwo = createLevelFixture(
    "Level Two",
    "<section>\n  <h2>Level Two</h2>\n  <p>Second level html marker should stay here.</p>\n</section>",
    "section { color: #1d4ed8; }\n/* level two css */",
  );
  const levelOneIdentifier = await createTemplateLevelFromFixture(request, "L1", levelOne);
  const levelTwoIdentifier = await createTemplateLevelFromFixture(request, "L2", levelTwo);
  await attachLevelToMap(request, mapName, levelOneIdentifier);
  await attachLevelToMap(request, mapName, levelTwoIdentifier);

  const group = await createGroup(request, creatorUsername, gameId, "group-a");
  const seedResponse = await request.patch(
    `${baseUrl}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(group.groupId)}`,
    {
      data: {
        progressData: {
          levels: [levelOne, levelTwo],
          testGroupLabel: "level-tab-switch",
        },
      },
    },
  );
  if (!seedResponse.ok()) {
    throw new Error(`Failed to seed multi-level instance for group ${group.groupId}: ${seedResponse.status()} ${await seedResponse.text()}`);
  }

  return { gameId, mapName, title, ...group };
}

async function createGroupModeGame(request, creatorUsername) {
  const title = `Playwright ${scenario} ${new Date().toISOString()}`;
  const createResponse = await request.post(`${baseUrl}/api/games`, {
    data: {
      title,
      progressData: {},
    },
  });
  if (!createResponse.ok()) {
    throw new Error(`Failed to create game: ${createResponse.status()} ${await createResponse.text()}`);
  }
  const createdGame = await createResponse.json();
  const gameId = createdGame.id;
  const mapName = createdGame.mapName;
  if (!gameId || !mapName) {
    throw new Error("Game create response did not include id/mapName.");
  }

  const updateResponse = await request.patch(`${baseUrl}/api/games/${gameId}`, {
    data: {
      collaborationMode: "group",
      ...((scenario === "same_user_duplicate" || flags.openExtraTabCount > 0)
        ? { allowDuplicateUsers: true }
        : {}),
      isPublic: true,
      title,
    },
  });
  if (!updateResponse.ok()) {
    throw new Error(`Failed to prepare created game ${gameId}: ${updateResponse.status()} ${await updateResponse.text()}`);
  }

  const templateLevelIdentifier = await createTemplateLevel(request, creatorUsername);
  await attachLevelToMap(request, mapName, templateLevelIdentifier);
  return { gameId, mapName, title };
}

async function waitForEditorOnPages(pages) {
  const pending = new Set(pages.map((_, index) => index));
  const maxPasses = 4;
  for (let pass = 1; pass <= maxPasses && pending.size > 0; pass += 1) {
    await startGroupGame(pages);

    for (const index of [...pending]) {
      const page = pages[index];
      const label = `page-${index + 1}`;
      try {
        await page.locator(".cm-content").first().waitFor({ timeout: scaledTimeout(8000) });
        console.log(`editor:ready ${label}`);
        pending.delete(index);
      } catch {
        await logPageEditorState(page, `${label}:editor-pass-${pass}`);
        if (pass >= 2) {
          await reloadGamePage(page, `${label}:pass-${pass}-retry`);
          await startGroupGame([page]);
        }
      }
    }

    if (pending.size > 0) {
      await pages[0].waitForTimeout(1000);
    }
  }

  if (pending.size > 0) {
    const firstPendingIndex = [...pending][0];
    await waitForEditorOnPage(pages[firstPendingIndex], `page-${firstPendingIndex + 1}`);
  }
}

async function verifyDuplicateBlockedModal(page, label) {
  const heading = page.getByRole("heading", { name: "Duplicate login detected" });
  await heading.waitFor({ timeout: scaledTimeout(20000) });
  await page.getByText("Connection blocked").waitFor({ timeout: scaledTimeout(10000) });
  await expect.poll(async () => {
    const bodyText = ((await page.locator("body").textContent().catch(() => "")) || "").toLowerCase();
    return bodyText.includes("already connected")
      || bodyText.includes("duplicate users are blocked")
      || bodyText.includes("identified as");
  }, {
    timeout: scaledTimeout(10000),
    message: "Duplicate-blocked modal did not show an identity/conflict message",
  }).toBe(true);
  await page.keyboard.press("Escape");
  await expect(heading).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(heading).toBeVisible();
  console.log(`duplicate-blocked-modal ${label}`);
}

async function verifyEvictionModal(page, label) {
  const heading = page.getByRole("heading", { name: "Duplicate session detected" });
  await heading.waitFor({ timeout: scaledTimeout(20000) });
  await page.getByText("Session conflict").waitFor({ timeout: scaledTimeout(10000) });
  const continueButton = page.getByRole("button", { name: "Continue in this session" });
  const readOnlyButton = page.getByRole("button", { name: "View read-only" });
  await expect(continueButton).toBeVisible({ timeout: scaledTimeout(5000) });
  await expect(readOnlyButton).toBeVisible({ timeout: scaledTimeout(5000) });
  // Verify the modal cannot be dismissed by Escape or clicking outside
  await page.keyboard.press("Escape");
  await expect(heading).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(heading).toBeVisible();
  console.log(`eviction-modal ${label}`);
}

async function dismissEvictionModalReadOnly(page, label) {
  const readOnlyButton = page.getByRole("button", { name: "View read-only" });
  await readOnlyButton.click();
  console.log(`eviction-modal:read-only ${label}`);
}

async function startGroupGame(pages) {
  if (routeKind === "prototype-yjs") {
    return;
  }
  for (const page of pages) {
    const waitingRoom = page.getByText("Group Waiting Room");
    await Promise.race([
      waitingRoom.first().waitFor({ timeout: scaledTimeout(10000) }).catch(() => null),
      page.locator(".cm-content").first().waitFor({ timeout: scaledTimeout(10000) }).catch(() => null),
    ]);
    if ((await waitingRoom.count()) > 0) {
      const startButton = page.getByRole("button", { name: "Start Game" });
      await expect.poll(async () => {
        const editorVisible = await page.locator(".cm-content").first().isVisible().catch(() => false);
        if (editorVisible) {
          return "editor";
        }

        const waitingRoomVisible = (await waitingRoom.count().catch(() => 0)) > 0;
        if (!waitingRoomVisible) {
          return "transitioning";
        }

        const cancelReadyButton = page.getByRole("button", { name: "Cancel Ready" });
        const startVisible = await startButton.isVisible().catch(() => false);
        const startEnabled = startVisible && await startButton.isEnabled().catch(() => false);
        if (startEnabled) {
          await startButton.click();
          return "clicked";
        }

        const cancelVisible = await cancelReadyButton.isVisible().catch(() => false);
        const bodyText = ((await page.locator("body").textContent().catch(() => "")) || "").toLowerCase();
        if (
          cancelVisible ||
          bodyText.includes("you are ready") ||
          bodyText.includes("starting game") ||
          bodyText.includes("reconnecting to shared room")
        ) {
          return "ready";
        }

        return startVisible ? "disabled" : "hidden";
      }, {
        timeout: scaledTimeout(20000),
        message: "Waiting room did not progress to a valid ready/editor state",
      }).not.toBe("disabled");
    }
  }
}

function isInGameFocusedScenario() {
  return scenario === "in_game_churn" || scenario === "in_game_duplicate";
}

async function getEditableContent(page) {
  return await page.evaluate(() => {
    const editableContent = document.querySelector(".cm-content[contenteditable='true']");
    if (!editableContent) {
      return "";
    }
    const cmEl = editableContent.closest(".cm-editor");
    let view = null;
    try { view = cmEl?.cmView?.view; } catch {}
    if (!view) {
      try { view = editableContent.parentNode?.cmView?.view; } catch {}
      if (!view) try { view = editableContent.cmView?.view; } catch {}
    }
    if (view?.state?.doc) {
      return view.state.doc.toString();
    }
    return editableContent.textContent || "";
  });
}

async function setEditorSelection(page, placement = "end", offset = 0) {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const positioned = await page.evaluate(({ nextPlacement, nextOffset }) => {
      const editableContent = document.querySelector(".cm-content[contenteditable='true']");
      if (!editableContent) {
        return false;
      }
      const cmEl = editableContent.closest(".cm-editor");
      const content = cmEl?.querySelector('.cm-content') ?? editableContent;
      let tile = content?.cmTile ?? cmEl?.cmTile;
      let view = tile?.root?.view ?? null;
      if (!view) {
        view = cmEl?.cmView?.view ?? content?.parentNode?.cmView?.view ?? content?.cmView?.view ?? null;
      }
      if (!view?.state?.doc) {
        return false;
      }
      const docLength = view.state.doc.length;
      const basePosition = nextPlacement === "start" ? 0 : docLength;
      const anchor = Math.max(0, Math.min(docLength, basePosition + nextOffset));
      view.dispatch({
        selection: { anchor, head: anchor },
        scrollIntoView: true,
      });
      view.focus();
      return true;
    }, { nextPlacement: placement, nextOffset: offset });

    if (positioned) {
      return;
    }

    await page.waitForTimeout(150);
  }

  const navigationModifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.locator(".cm-content[contenteditable='true']").first().click();
  await page.keyboard.press(
    placement === "start" ? `${navigationModifier}+ArrowUp` : `${navigationModifier}+ArrowDown`,
  );
  if (offset !== 0) {
    const key = offset < 0 ? "ArrowLeft" : "ArrowRight";
    for (let step = 0; step < Math.abs(offset); step += 1) {
      await page.keyboard.press(key);
    }
  }

  const confirmed = await page.evaluate(({ nextPlacement, nextOffset }) => {
    const editableContent = document.querySelector(".cm-content[contenteditable='true']");
    if (!editableContent) {
      return false;
    }
    const cmEl = editableContent.closest(".cm-editor");
    const content = cmEl?.querySelector('.cm-content') ?? editableContent;
    let tile = content?.cmTile ?? cmEl?.cmTile;
    let view = tile?.root?.view ?? null;
    if (!view) {
      view = cmEl?.cmView?.view ?? content?.parentNode?.cmView?.view ?? content?.cmView?.view ?? null;
    }
    if (!view?.state?.selection?.main) {
      return true;
    }
    const docLength = view.state.doc.length;
    const expectedBase = nextPlacement === "start" ? 0 : docLength;
    const expectedAnchor = Math.max(0, Math.min(docLength, expectedBase + nextOffset));
    return view.state.selection.main.anchor === expectedAnchor;
  }, { nextPlacement: placement, nextOffset: offset });

  if (!confirmed) {
    throw new Error(`Failed to position CodeMirror selection at ${placement}:${offset}`);
  }
}

/**
 * Resolve a live EditorView from a .cm-editor or .cm-content DOM element.
 * Modern @codemirror/view (6.x) stores a cmTile reference on DOM nodes;
 * older bundled copies (e.g. inside y-codemirror.next) used cmView.
 * We try both so the helper works regardless of which bundle rendered the editor.
 */
function findCmViewJS() {
  return `(function findCmView(cmEditorEl) {
    // Modern path: cmTile -> tile.root.view
    const content = cmEditorEl.querySelector('.cm-content') ?? cmEditorEl;
    let tile = content?.cmTile ?? cmEditorEl?.cmTile;
    let view = tile?.root?.view ?? null;
    if (view) return view;
    // Legacy path: cmView.view (used in bundled copies of CM inside y-codemirror.next)
    view = cmEditorEl?.cmView?.view ?? content?.parentNode?.cmView?.view ?? content?.cmView?.view ?? null;
    return view;
  })`;
}

async function insertEditorText(page, text) {
  const inserted = await page.evaluate((nextText) => {
    const editableContent = document.querySelector(".cm-content[contenteditable='true']");
    if (!editableContent) return false;
    const cmEditorEl = editableContent.closest(".cm-editor");
    if (!cmEditorEl) return false;
    const findCmView = (function findCmView(el) {
      const content = el.querySelector('.cm-content') ?? el;
      let tile = content?.cmTile ?? el?.cmTile;
      let view = tile?.root?.view ?? null;
      if (view) return view;
      return el?.cmView?.view ?? content?.parentNode?.cmView?.view ?? content?.cmView?.view ?? null;
    });
    const view = findCmView(cmEditorEl);
    if (!view?.state) return false;
    const range = view.state.selection.main;
    const insertAt = range.from + nextText.length;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: nextText },
      selection: { anchor: insertAt, head: insertAt },
      scrollIntoView: true,
    });
    view.focus();
    return true;
  }, text);

  if (!inserted) {
    // If CodeMirror API not accessible, fall back to keyboard typing.
    const editorEl = page.locator(".cm-content[contenteditable='true']").first();
    await editorEl.click();
    await page.keyboard.type(text, { delay: 10 });
  }
}

async function logPageEditorState(page, label) {
  const url = page.url();
  const editableCount = await page.locator(".cm-content[contenteditable='true']").count().catch(() => 0);
  const readOnlyCount = await page.locator(".cm-content[contenteditable='false']").count().catch(() => 0);
  const waitingRoomCount = await page.getByText("Group Waiting Room").count().catch(() => 0);
  const loadingCount = await page.getByText("Loading", { exact: false }).count().catch(() => 0);
  const bodyText = await page.locator("body").textContent().catch(() => "");
  console.warn(
    `[page-state:${label}] url=${url} editable=${editableCount} readOnly=${readOnlyCount} waitingRoom=${waitingRoomCount} loading=${loadingCount} body=${JSON.stringify((bodyText || "").slice(0, 200))}`
  );
}

async function triggerLevelReset(page) {
  const titledResetButtons = page.getByTitle("Reset Level");
  const namedResetButtons = page.getByRole("button", { name: "Reset" });
  const gameMenuTrigger = page.getByRole("button", { name: "Game", exact: true });
  const levelMenuTriggers = page.getByRole("button", { name: /Level/i });
  const levelTextButtons = page.locator("button").filter({ hasText: /^Level$/i });
  let requiresConfirmation = true;

  if ((await titledResetButtons.count()) > 0 && await titledResetButtons.first().isVisible().catch(() => false)) {
    await titledResetButtons.first().click();
  } else if ((await namedResetButtons.count()) > 0 && await namedResetButtons.first().isVisible().catch(() => false)) {
    await namedResetButtons.first().click();
  } else if ((await levelMenuTriggers.count()) > 0) {
    let clickedLevelMenu = false;
    const levelMenuCount = await levelMenuTriggers.count();
    for (let index = 0; index < levelMenuCount; index += 1) {
      const candidate = levelMenuTriggers.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        clickedLevelMenu = true;
        break;
      }
    }
    if (!clickedLevelMenu) {
      throw new Error("Level menu trigger was found but not visible.");
    }
    await page.getByRole("button", { name: "Reset level" }).waitFor({ timeout: scaledTimeout(10000) });
    await page.getByRole("button", { name: "Reset level" }).click();
    requiresConfirmation = false;
  } else if ((await levelTextButtons.count()) > 0) {
    let clickedLevelMenu = false;
    const levelTextButtonCount = await levelTextButtons.count();
    for (let index = 0; index < levelTextButtonCount; index += 1) {
      const candidate = levelTextButtons.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        await candidate.click();
        clickedLevelMenu = true;
        break;
      }
    }
    if (!clickedLevelMenu) {
      throw new Error("Level text button was found but not visible.");
    }
    await page.getByRole("button", { name: "Reset level" }).waitFor({ timeout: scaledTimeout(10000) });
    await page.getByRole("button", { name: "Reset level" }).click();
    requiresConfirmation = false;
  } else if ((await gameMenuTrigger.count()) > 0 && await gameMenuTrigger.first().isVisible().catch(() => false)) {
    await gameMenuTrigger.first().click();
    await page.getByRole("menuitem", { name: "Reset Level" }).waitFor({ timeout: scaledTimeout(10000) });
    await page.getByRole("menuitem", { name: "Reset Level" }).click();
  } else {
    throw new Error("Reset controls were not visible on the page.");
  }

  if (requiresConfirmation) {
    await page.getByRole("dialog").waitFor({ timeout: scaledTimeout(10000) });
    await page.getByRole("heading", { name: "Reset Level" }).waitFor({ timeout: scaledTimeout(10000) });
    await page.getByRole("button", { name: "Yes" }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: scaledTimeout(10000) });
  }
}

async function verifyLevelReset(group, contexts) {
  if (routeKind === "prototype-yjs") {
    return true;
  }
  const indexes = group.activeMemberIndexes ?? group.memberIndexes;
  const memberPages = indexes.map((memberIndex) => contexts[memberIndex].page);
  const templateHtml = createStarterLevel().code.html.replace(/\n/g, "");
  const resetMarker = `pw-reset-${Date.now().toString(36)}`;
  const sourceEditor = memberPages[0].locator(".cm-content[contenteditable='true']").first();
  await sourceEditor.click();
  await setEditorSelection(memberPages[0], "end");
  await memberPages[0].keyboard.type(`\n<!-- ${resetMarker} -->`);
  await memberPages[0].waitForTimeout(Math.max(createWaitMs * 2, 2000));
  await triggerLevelReset(memberPages[0]);
  // Yjs reset requires doc replacement + editor remount, give it extra time
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await memberPages[0].waitForTimeout(attempt === 1 ? Math.max(createWaitMs * 3, 4000) : 1500);
    const contents = await Promise.all(memberPages.map((page) => getEditableContent(page)));
    const normalized = contents.map((content) => content.replace(/\n/g, ""));
    const ok = normalized.every((content) => content.includes(templateHtml) && !content.includes(resetMarker));
    if (ok) {
      return true;
    }
    if (attempt === maxAttempts) {
      console.warn(`[verifyLevelReset:fail] templateHtml=${JSON.stringify(templateHtml.slice(0, 80))}`);
      normalized.forEach((content, index) => {
        console.warn(`[verifyLevelReset:fail] page[${index}] content=${JSON.stringify(content.slice(0, 200))} hasTemplate=${content.includes(templateHtml)} hasMarker=${content.includes(resetMarker)}`);
      });
    }
  }
  return false;
}

async function trySharedEdit(pages, marker) {
  if (pages.length < 2) return false;
  const editor = pages[0].locator(".cm-content[contenteditable='true']").first();
  await editor.waitFor({ timeout: scaledTimeout(10000) });
  await editor.click();
  await setEditorSelection(pages[0], "end");
  await pages[0].keyboard.type(`\n<!-- ${marker} -->`);
  await pages[0].waitForTimeout(createWaitMs);
  const target = pages[pages.length - 1].locator(".cm-content[contenteditable='true']").first();
  await target.waitFor({ timeout: scaledTimeout(10000) });
  const observed = await getEditableContent(pages[pages.length - 1]);
  return observed.includes(marker);
}

async function waitForMarkerOnPage(page, marker, label, timeoutMs = scaledTimeout(12000)) {
  const startedAt = Date.now();
  let lastContent = "";
  while (Date.now() - startedAt < timeoutMs) {
    lastContent = await getEditableContent(page);
    if (lastContent.includes(marker)) {
      return true;
    }
    await page.waitForTimeout(500);
  }
  console.warn(`[marker:missing] ${label} marker=${marker} content=${JSON.stringify(lastContent.slice(-240))}`);
  return false;
}

async function waitForPagesConverged(pages, requiredMarkers, label, timeoutMs = scaledTimeout(15000)) {
  const startedAt = Date.now();
  let lastContents = [];
  let stablePasses = 0;
  while (Date.now() - startedAt < timeoutMs) {
    lastContents = await Promise.all(pages.map((page) => getEditableContent(page)));
    const converged = lastContents.length > 0 && lastContents.every((content) => content === lastContents[0]);
    const containsMarkers =
      requiredMarkers.length === 0
        ? true
        : lastContents.every((content) => requiredMarkers.every((marker) => content.includes(marker)));
    if (converged && containsMarkers) {
      stablePasses += 1;
      if (stablePasses >= 2) {
        return {
          ok: true,
          contents: lastContents,
        };
      }
    } else {
      stablePasses = 0;
    }
    await pages[0].waitForTimeout(750);
  }
  lastContents.forEach((content, index) => {
    console.warn(`[converge:fail] ${label} page=${index} content=${JSON.stringify(content.slice(-260))}`);
  });
  return {
    ok: false,
    contents: lastContents,
  };
}

async function waitForEditorsSettled(pages, label, timeoutMs = scaledTimeout(10000)) {
  const startedAt = Date.now();
  let stablePasses = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const states = await Promise.all(pages.map(async (page) => {
      const editable = (await page.locator(".cm-content[contenteditable='true']").count().catch(() => 0)) > 0;
      const content = await getEditableContent(page).catch(() => "");
      return { editable, content };
    }));
    const allEditable = states.every((state) => state.editable);
    const converged = states.length > 0 && states.every((state) => state.content === states[0].content);
    if (allEditable && converged) {
      stablePasses += 1;
      if (stablePasses >= 3) {
        return true;
      }
    } else {
      stablePasses = 0;
    }
    await pages[0].waitForTimeout(500);
  }
  await Promise.all(pages.map((page, index) => logPageEditorState(page, `${label}:settle:${index}`)));
  return false;
}

async function typeMarkerSlowly(page, marker) {
  const editor = page.locator(".cm-content[contenteditable='true']").first();
  await editor.click();
  await setEditorSelection(page, "end");
  await page.keyboard.type(`\n<!-- ${marker} -->`, { delay: 35 });
}

async function tryConcurrentSharedEdit(pages, groupName) {
  if (pages.length < 2) return false;
  const activeEditors = Math.min(pages.length, concurrentEditors);
  const markers = Array.from({ length: activeEditors }, (_, index) => `pw-concurrent-${index + 1}-${Date.now().toString(36)}`);
  const placements = Array.from({ length: activeEditors }, (_, index) => {
    if (index === 0) return "start";
    if (index === 1) return "end";
    return index % 2 === 0 ? "start-offset" : "end-offset";
  });
  await Promise.all(
    Array.from({ length: activeEditors }, (_, index) => (async () => {
      const editor = pages[index].locator(".cm-content[contenteditable='true']").first();
      await editor.click();
      const placement = placements[index];
      const selectionPlacement = placement.startsWith("start") ? "start" : "end";
      const selectionOffset =
        placement === "start-offset"
          ? 2
          : placement === "end-offset"
            ? -2
            : 0;
      await setEditorSelection(pages[index], selectionPlacement, selectionOffset);
      await pages[index].keyboard.type(`\n<!-- ${markers[index]} -->`);
    })()),
  );
  const maxAttempts = 6;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await pages[0].waitForTimeout(
      attempt === 1 ? Math.max(createWaitMs * 2, 2500) : Math.max(createWaitMs, 1200),
    );
    const pageContents = await Promise.all(
      pages.map(async (page, index) => {
        try {
          return await getEditableContent(page);
        } catch (error) {
          await logPageEditorState(page, `${groupName}:${index}`);
          throw error;
        }
      }),
    );
    const merged = pageContents.every((content) => markers.every((marker) => content.includes(marker)));
    if (merged) {
      return true;
    }
    if (attempt === maxAttempts) {
      console.warn(`concurrent markers failed in ${groupName}`);
      pageContents.forEach((content, index) => {
        const missingMarkers = markers.filter((marker) => !content.includes(marker));
        console.warn(
          `[concurrent:fail] ${groupName} page=${index} missing=${missingMarkers.join(",")} content=${JSON.stringify(content.slice(-220))}`,
        );
      });
    }
  }
  return false;
}

function countChar(content, char) {
  let count = 0;
  for (const value of content) {
    if (value === char) {
      count += 1;
    }
  }
  return count;
}

async function trySamePositionConcurrentEdit(pages, groupName) {
  if (pages.length < 2) return false;
  const activeEditors = Math.min(pages.length, 2);
  const beforeContents = await Promise.all(pages.slice(0, activeEditors).map((page) => getEditableContent(page)));
  const payloads = ["Q".repeat(12), "Z".repeat(12)];

  await Promise.all(
    Array.from({ length: activeEditors }, (_, index) => (async () => {
      const editor = pages[index].locator(".cm-content[contenteditable='true']").first();
      await editor.click();
      await setEditorSelection(pages[index], "end");
      await pages[index].keyboard.type(payloads[index]);
    })()),
  );

  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await pages[0].waitForTimeout(
      attempt === 1 ? Math.max(createWaitMs * 2, 2500) : Math.max(createWaitMs, 1200),
    );
    const pageContents = await Promise.all(
      pages.slice(0, activeEditors).map(async (page, index) => {
        try {
          return await getEditableContent(page);
        } catch (error) {
          await logPageEditorState(page, `${groupName}:same-position:${index}`);
          throw error;
        }
      }),
    );

    const converged = pageContents.every((content) => content === pageContents[0]);
    const preserved = pageContents.every((content, index) =>
      payloads.every((payload, payloadIndex) =>
        countChar(content, payload[0]) - countChar(beforeContents[index], payload[0]) === payload.length,
      ),
    );

    if (converged && preserved) {
      return true;
    }

    if (attempt === maxAttempts) {
      console.warn(`same-position concurrent markers failed in ${groupName}`);
      pageContents.forEach((content, index) => {
        const diffs = payloads.map((payload) =>
          `${payload[0]}:${countChar(content, payload[0]) - countChar(beforeContents[index], payload[0])}/${payload.length}`,
        );
        console.warn(
          `[same-position:fail] ${groupName} page=${index} converged=${converged} diffs=${diffs.join(" ")} content=${JSON.stringify(content.slice(-220))}`,
        );
      });
    }
  }

  return false;
}

/**
 * Edit-stability check: types a marker on the target page while OTHER pages
 * type concurrently, creating conditions for divergence when the target page
 * drops incoming Yjs updates. The target page's content hash will differ from
 * the server's (missing other users' edits), triggering divergence_detected
 * and the replaceLocalYDoc recovery path.
 *
 * The test then polls the target page to verify the marker is NOT reverted
 * by the recovery. Pre-fix code (empty Y.Doc on replace) causes the marker
 * to disappear. Fixed code (pre-hydrated Y.Doc) preserves it.
 *
 * @param {import("@playwright/test").Page} targetPage  The page that should retain its edit
 * @param {import("@playwright/test").Page[]} allPages  All pages in the group
 * @param {string} groupName  For logging
 * @param {object} [opts]
 * @param {number} [opts.stabilityWindowMs]  How long the marker must persist (default 10s)
 * @param {number} [opts.pollIntervalMs]     Check interval (default 400ms)
 * @returns {Promise<{stable: boolean, appearedAt: number|null, disappearedAt: number|null, convergedToPeers: boolean}>}
 */
async function tryEditStability(targetPage, allPages, groupName, opts = {}) {
  const stabilityWindowMs = opts.stabilityWindowMs ?? 10000;
  const pollIntervalMs = opts.pollIntervalMs ?? 400;
  // droppingPage: if provided, drops are started AFTER the initial marker is confirmed,
  // so that pending delayed WS messages don't race with the first edit.
  const droppingPage = opts.droppingPage ?? null;

  const marker = `pw-stable-${Date.now().toString(36)}`;
  const otherPages = allPages.filter((p) => p !== targetPage);

  // Type the marker on the target page (drops must be off so the edit goes through cleanly)
  const editor = targetPage.locator(".cm-content[contenteditable='true']").first();
  await editor.click();
  await setEditorSelection(targetPage, "end");
  await insertEditorText(targetPage, `\n<!-- ${marker} -->`);

  // Wait for the marker to first appear on the target page
  let appearedAt = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const content = await getEditableContent(targetPage);
    if (content.includes(marker)) {
      appearedAt = Date.now();
      break;
    }
    await targetPage.waitForTimeout(250);
  }

  if (!appearedAt) {
    console.warn(`[stability:never-appeared] ${groupName} marker=${marker}`);
    return { stable: false, appearedAt: null, disappearedAt: null, convergedToPeers: false };
  }

  // Now that the initial marker is safely written, begin dropping so that background
  // edits on peer pages create a divergence without racing with the first insert.
  if (droppingPage) {
    startDroppingYjsUpdates(droppingPage);
  }

  // Have ONE other page type a few edits to create divergence conditions.
  // The target page is dropping incoming Yjs updates, so it won't see these
  // edits → its hash will differ from the server's → divergence_detected fires.
  // Only type on one page with pauses to avoid destabilizing the test.
  const bgPage = otherPages[0];
  const bgTypingPromise = (async () => {
    for (let round = 0; round < 4; round++) {
      try {
        const otherEditor = bgPage.locator(".cm-content[contenteditable='true']").first();
        await otherEditor.click();
        await setEditorSelection(bgPage, "end");
        await bgPage.keyboard.type(`\n<!-- bg-${round} -->`, { delay: 40 });
      } catch {
        // page may have navigated or closed
      }
      await bgPage.waitForTimeout(1500);
    }
  })();

  // Poll the target page: the marker must not disappear
  let disappearedAt = null;
  let checks = 0;
  const deadline = Date.now() + stabilityWindowMs;
  while (Date.now() < deadline) {
    await targetPage.waitForTimeout(pollIntervalMs);
    checks++;
    const content = await getEditableContent(targetPage);
    if (!content.includes(marker)) {
      disappearedAt = Date.now();
      console.warn(
        `[stability:reverted] ${groupName} marker=${marker} afterMs=${disappearedAt - appearedAt} checks=${checks} content=${JSON.stringify(content.slice(-200))}`,
      );
      break;
    }
  }

  // Wait for background typing to finish
  await bgTypingPromise;

  let convergedToPeers = true;
  if (disappearedAt === null) {
    // End the synthetic partition before checking convergence. The usability goal
    // is "recover once the bad network condition clears", not "magically converge
    // while inbound collaboration traffic is still being dropped on this page".
    stopDroppingYjsUpdates(targetPage);
    await targetPage.waitForTimeout(600);

    // Verify the marker eventually reaches other pages once traffic resumes.
    for (const page of otherPages) {
      try {
        const hasMarker = await waitForMarkerOnPage(page, marker, `${groupName}:stability-converge`, scaledTimeout(10000));
        if (!hasMarker) {
          console.warn(`[stability:no-converge] ${groupName} marker=${marker} did not reach all pages`);
          convergedToPeers = false;
        }
      } catch (err) {
        console.warn(`[stability:converge-error] ${groupName} marker=${marker} ${err.message?.slice(0, 100)}`);
        convergedToPeers = false;
      }
    }
  }

  const stable = disappearedAt === null && convergedToPeers;
  console.log(`stability:check ${groupName} stable=${stable} checks=${checks} marker=${marker}`);
  return { stable, appearedAt, disappearedAt, convergedToPeers };
}

async function switchToEditorTab(page, label) {
  await page.getByRole("tab", { name: label }).click();
  await page.waitForTimeout(300);
  await page.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: scaledTimeout(20000) });
}

async function switchToLevel(page, levelName) {
  const trigger = page.getByRole("combobox").first();
  await trigger.click();
  const option = page.getByRole("option", { name: new RegExp(levelName) }).first();
  await option.click();
  await page.waitForTimeout(400);
  await page.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: scaledTimeout(20000) });
}

async function appendMarker(page, marker, commentStyle = "html") {
  const editor = page.locator(".cm-content[contenteditable='true']").first();
  await editor.click();
  await setEditorSelection(page, "end");
  const wrapped =
    commentStyle === "css"
      ? `\n/* ${marker} */`
      : commentStyle === "js"
        ? `\n// ${marker}`
        : `\n<!-- ${marker} -->`;
  await page.keyboard.type(wrapped);
  await page.waitForTimeout(Math.max(createWaitMs, 1200));
}

async function verifyLevelAndTabIsolation(group, contexts) {
  const memberPages = group.memberIndexes.map((memberIndex) => contexts[memberIndex].page);
  if (memberPages.length < 3) {
    throw new Error("level_tab_switch scenario requires 3 members in the group");
  }

  const htmlLevelOneMarker = `pw-level1-html-${Date.now().toString(36)}`;
  const htmlLevelTwoMarker = `pw-level2-html-${Date.now().toString(36)}`;
  const cssLevelOneMarker = `pw-level1-css-${Date.now().toString(36)}`;
  const levelOneName = "Level One";
  const levelTwoName = "Level Two";

  await switchToLevel(memberPages[0], levelOneName);
  await switchToEditorTab(memberPages[0], "HTML");
  await appendMarker(memberPages[0], htmlLevelOneMarker, "html");

  await switchToLevel(memberPages[1], levelTwoName);
  await switchToEditorTab(memberPages[1], "HTML");
  await appendMarker(memberPages[1], htmlLevelTwoMarker, "html");

  await switchToLevel(memberPages[2], levelOneName);
  await switchToEditorTab(memberPages[2], "CSS");
  await appendMarker(memberPages[2], cssLevelOneMarker, "css");

  await Promise.all(memberPages.map((page) => page.waitForTimeout(Math.max(createWaitMs * 2, 2500))));

  const checks = [
    {
      levelName: levelOneName,
      tab: "HTML",
      mustHave: [htmlLevelOneMarker],
      mustNotHave: [htmlLevelTwoMarker, cssLevelOneMarker],
    },
    {
      levelName: levelTwoName,
      tab: "HTML",
      mustHave: [htmlLevelTwoMarker],
      mustNotHave: [htmlLevelOneMarker, cssLevelOneMarker],
    },
    {
      levelName: levelOneName,
      tab: "CSS",
      mustHave: [cssLevelOneMarker],
      mustNotHave: [htmlLevelOneMarker, htmlLevelTwoMarker],
    },
  ];

  for (const page of memberPages) {
    for (const check of checks) {
      await switchToLevel(page, check.levelName);
      await switchToEditorTab(page, check.tab);
      const content = await getEditableContent(page);
      const hasExpected = check.mustHave.every((marker) => content.includes(marker));
      const hasUnexpected = check.mustNotHave.some((marker) => content.includes(marker));
      if (!hasExpected || hasUnexpected) {
        console.warn(
          `[level-tab-check:fail] group=${group.groupName} level=${check.levelName} tab=${check.tab} content=${JSON.stringify(content.slice(0, 300))}`,
        );
        return false;
      }
    }
  }

  return true;
}

async function dbClient() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  return client;
}

async function fetchLtiConsumerKey() {
  if (process.env.PLAYWRIGHT_LTI_CONSUMER_KEY) {
    return process.env.PLAYWRIGHT_LTI_CONSUMER_KEY;
  }

  const client = await dbClient();
  try {
    const result = await client.query(`SELECT consumer_key FROM lti_credentials ORDER BY consumer_key ASC LIMIT 1`);
    if (result.rows[0]?.consumer_key) {
      return result.rows[0].consumer_key;
    }
  } finally {
    await client.end();
  }

  try {
    const devLog = readFileSync(".next/dev/logs/next-development.log", "utf8");
    const matches = [...devLog.matchAll(/oauth_consumer_key[^0-9a-f-]*([0-9a-f-]{36})/gi)];
    return matches.at(-1)?.[1] || null;
  } catch {
    return null;
  }
}

async function ensureLtiCredential(consumerKey, ownerEmail) {
  const client = await dbClient();
  try {
    const ownerResult = await client.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [ownerEmail]);
    const ownerId = ownerResult.rows[0]?.id;
    if (!ownerId) {
      throw new Error(`Could not find user id for ${ownerEmail}`);
    }
    await client.query(
      `INSERT INTO lti_credentials (user_id, consumer_key, consumer_secret)
       VALUES ($1, $2, $3)
       ON CONFLICT (consumer_key) DO NOTHING`,
      [ownerId, consumerKey, "playwright-secret"],
    );
  } finally {
    await client.end();
  }
}

async function fetchAttemptParticipants(attemptId) {
  const client = await dbClient();
  try {
    const result = await client.query(
      `SELECT COALESCE(NULLIF(TRIM(display_name), ''), user_id::text, 'unknown') AS display_name
       FROM game_attempt_participants
       WHERE attempt_id = $1
       ORDER BY display_name ASC`,
      [attemptId],
    );
    return result.rows.map((row) => String(row.display_name));
  } finally {
    await client.end();
  }
}

async function fetchInstanceState(gameId, groupId) {
  const client = await dbClient();
  try {
    const result = await client.query(
      `SELECT id, progress_data
       FROM game_instances
       WHERE game_id = $1 AND group_id = $2
       LIMIT 1`,
      [gameId, groupId],
    );
    return result.rows[0] || null;
  } finally {
    await client.end();
  }
}

async function fetchGameInstanceCount(gameId) {
  const client = await dbClient();
  try {
    const result = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM game_instances
       WHERE game_id = $1`,
      [gameId],
    );
    return Number(result.rows[0]?.count || 0);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// classroom_text_production: each user types their assigned fragment while
// random chaos events disturb the group. No user fills in for another.
// ---------------------------------------------------------------------------

// Fragments use only simple alphanumeric words to avoid CodeMirror textContent
// splitting issues with punctuation. Each fragment is unique and greppable.
const TEXT_PRODUCTION_FRAGMENTS = [
  "alpha bravo charlie delta echo foxtrot",
  "golf hotel india juliet kilo lima",
  "mike november oscar papa quebec romeo",
  "sierra tango uniform victor whiskey xray",
  "zulu amber bronze coral desert ember",
  "flame glacier harbor ivory jasper knight",
  "lantern meadow nebula orchid prism quartz",
  "ripple shadow timber umbra velvet walrus",
  "xenon yield zenith arctic breeze cedar",
  "drift ember falcon granite haven indent",
  "jovial kindle luster marble nimbus opaque",
  "pebble riddle summit temple utmost vertex",
];

const CHAOS_EVENTS = [
  "none",
  "refresh_typer",
  "refresh_other",
  "ws_drop_typer",
  "ws_drop_other",
  "extra_tab_typer",
  "close_reopen_typer",
  "latency_spike",
];

function pickRandomChaosEvent(rng) {
  return CHAOS_EVENTS[Math.floor(rng() * CHAOS_EVENTS.length)];
}

// Simple seeded RNG so runs are reproducible with PLAYWRIGHT_CHAOS_SEED
function createSeededRng(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0x100000000;
  };
}

async function applyChaosEvent(chaosType, typerPage, otherPages, allContexts, group, typerIndex, contexts) {
  const log = (msg) => console.log(`chaos:${chaosType} ${msg}`);

  if (chaosType === "none") {
    log(`${group.groupName} no chaos`);
    return;
  }

  if (chaosType === "refresh_typer") {
    log(`${group.groupName} refreshing typer page`);
    await reloadGamePage(typerPage, `chaos-refresh:${contexts[typerIndex].username}`);
    await waitForEditorOnPage(typerPage, `chaos-refresh:${contexts[typerIndex].username}`);
    return;
  }

  if (chaosType === "refresh_other" && otherPages.length > 0) {
    const targetPage = otherPages[Math.floor(Math.random() * otherPages.length)];
    const targetIdx = allContexts.findIndex((c) => c.page === targetPage);
    log(`${group.groupName} refreshing other user ${allContexts[targetIdx]?.username}`);
    await reloadGamePage(targetPage, `chaos-refresh-other:${allContexts[targetIdx]?.username}`);
    await waitForEditorOnPage(targetPage, `chaos-refresh-other:${allContexts[targetIdx]?.username}`);
    return;
  }

  if (chaosType === "ws_drop_typer") {
    log(`${group.groupName} dropping Yjs updates on typer for 3s`);
    startDroppingYjsUpdates(typerPage);
    await typerPage.waitForTimeout(3000);
    stopDroppingYjsUpdates(typerPage);
    return;
  }

  if (chaosType === "ws_drop_other" && otherPages.length > 0) {
    const targetPage = otherPages[Math.floor(Math.random() * otherPages.length)];
    log(`${group.groupName} dropping Yjs updates on other user for 3s`);
    startDroppingYjsUpdates(targetPage);
    await targetPage.waitForTimeout(3000);
    stopDroppingYjsUpdates(targetPage);
    return;
  }

  if (chaosType === "extra_tab_typer") {
    const typerCtx = contexts[typerIndex];
    log(`${group.groupName} opening extra tab for typer ${typerCtx.username}`);
    const extraPage = await typerCtx.context.newPage();
    await enableWsReceiveDelay(extraPage);
    await gotoGamePage(extraPage, gameUrl(activeGameId, group.groupId), `chaos-extra-tab:${typerCtx.username}`);
    await typerPage.waitForTimeout(2000);
    await extraPage.close().catch(() => {});
    // The extra tab may have evicted the typer's main page. Reclaim if needed.
    const evictionHeading = typerPage.getByRole("heading", { name: "Duplicate session detected" });
    const isEvicted = await evictionHeading.isVisible().catch(() => false);
    if (isEvicted) {
      await typerPage.keyboard.press("Enter");
      log(`${group.groupName} reclaimed typer ${typerCtx.username} after extra tab`);
      await typerPage.locator(".cm-content").first().waitFor({ timeout: scaledTimeout(10000) });
    }
    return;
  }

  if (chaosType === "close_reopen_typer") {
    log(`${group.groupName} close+reopen typer ${contexts[typerIndex].username}`);
    await closeAndReopenMember(group, contexts, typerIndex);
    return;
  }

  if (chaosType === "latency_spike") {
    // Drop Yjs updates on all pages briefly to simulate a network partition
    log(`${group.groupName} simulating network partition (drop all Yjs for 3s)`);
    const allPages = [typerPage, ...otherPages];
    for (const p of allPages) startDroppingYjsUpdates(p);
    await typerPage.waitForTimeout(3000);
    for (const p of allPages) stopDroppingYjsUpdates(p);
    return;
  }

  // Fallback: no chaos if event doesn't apply (e.g. refresh_other with no others)
  log(`${group.groupName} skipped (not applicable)`);
}

function createTextProductionLevel(slotCount) {
  const slots = Array.from({ length: slotCount }, (_, i) => `  <p>SLOT_${i + 1}_EMPTY</p>`).join("\n");
  const level = createStarterLevel();
  return {
    ...level,
    name: "text-production",
    code: {
      html: `<main>\n  <h1>Collaborative Text</h1>\n${slots}\n</main>`,
      css: level.code.css,
      js: "",
    },
  };
}

async function seedTextProductionInstance(request, gameId, groupId, label, slotCount) {
  const level = createTextProductionLevel(slotCount);
  const seedResponse = await request.patch(
    `${baseUrl}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
    {
      data: {
        progressData: {
          levels: [level],
          testGroupLabel: label,
        },
      },
    },
  );
  if (!seedResponse.ok()) {
    throw new Error(`Failed to seed text-production level for group ${groupId}: ${seedResponse.status()} ${await seedResponse.text()}`);
  }
}

async function runTextProductionForGroup(group, contexts) {
  const memberIndexes = group.activeMemberIndexes ?? group.memberIndexes;
  // Helper to always get current pages (after close/reopen, contexts[idx].page changes)
  const getCurrentPages = () => memberIndexes.map((idx) => contexts[idx].page);
  const memberUsernames = memberIndexes.map((idx) => contexts[idx].username);

  // Assign fragments: one per user in this group, each targeting their own slot
  const groupFragmentOffset = group.memberIndexes[0]; // offset into global fragment list
  const assignments = memberIndexes.map((idx, localIdx) => {
    const uname = contexts[idx].username;
    const fragment = TEXT_PRODUCTION_FRAGMENTS[groupFragmentOffset + localIdx] ||
      `fragment ${groupFragmentOffset + localIdx + 1} by ${uname}`;
    const slotPlaceholder = `SLOT_${localIdx + 1}_EMPTY`;
    // The completed marker is what we check for in the final content
    const marker = `[${uname}] ${fragment}`;
    return { userIndex: idx, username: uname, fragment, marker, slotPlaceholder, slotIndex: localIdx };
  });

  const chaosSeed = Number.parseInt(process.env.PLAYWRIGHT_CHAOS_SEED || `${Date.now()}`, 10);
  const rng = createSeededRng(chaosSeed);
  console.log(`text-production:start ${group.groupName} chaosSeed=${chaosSeed} users=${memberUsernames.join(",")}`);

  // Helper: select a slot placeholder in the editor via CM6 view API
  async function selectSlot(page, placeholder) {
    return await page.evaluate((ph) => {
      const editableContent = document.querySelector(".cm-content[contenteditable='true']");
      if (!editableContent) return "no-editable-cm";
      const cmEl = editableContent.closest(".cm-editor");
      if (!cmEl) return "no-cm-editor";
      const content = cmEl.querySelector('.cm-content') ?? editableContent;
      let tile = content?.cmTile ?? cmEl?.cmTile;
      let view = tile?.root?.view ?? null;
      if (!view) {
        view = cmEl?.cmView?.view ?? content?.parentNode?.cmView?.view ?? content?.cmView?.view ?? null;
      }
      if (!view || !view.state) {
        return `no-view-found`;
      }
      const doc = view.state.doc.toString();
      const pos = doc.indexOf(ph);
      if (pos === -1) return `slot-missing:${doc.substring(0, 200)}`;
      view.dispatch({
        selection: { anchor: pos, head: pos + ph.length },
        scrollIntoView: true,
      });
      view.focus();
      return "ok";
    }, placeholder);
  }

  // Assign a chaos event to each user upfront
  const chaosAssignments = assignments.map((a) => ({
    ...a,
    chaosType: pickRandomChaosEvent(rng),
  }));

  for (const ca of chaosAssignments) {
    console.log(`text-production:plan ${group.groupName} user=${ca.username} chaos=${ca.chaosType} fragment="${ca.fragment.slice(0, 40)}..."`);
  }

  // Phase 1: Apply all chaos events concurrently (before anyone types)
  console.log(`text-production:chaos-phase ${group.groupName}`);
  await Promise.allSettled(
    chaosAssignments.map(async (ca) => {
      const typerPage = contexts[ca.userIndex].page;
      const otherPages = getCurrentPages().filter((p) => p !== typerPage);
      try {
        await applyChaosEvent(ca.chaosType, typerPage, otherPages, contexts, group, ca.userIndex, contexts);
      } catch (error) {
        console.warn(`text-production:chaos-error ${group.groupName} user=${ca.username} chaos=${ca.chaosType} error=${error.message}`);
      }
    }),
  );

  // Brief settle after chaos
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Phase 2: All users type their slots SIMULTANEOUSLY
  console.log(`text-production:type-phase ${group.groupName} (all users typing at once)`);
  const turnResults = await Promise.all(
    chaosAssignments.map(async (ca) => {
      const { userIndex, username, fragment, marker, slotPlaceholder, chaosType } = ca;
      const currentPage = contexts[userIndex].page;
      let typeOk = false;

      try {
        const editor = currentPage.locator(".cm-content[contenteditable='true']").first();
        await editor.waitFor({ timeout: scaledTimeout(10000) });

        // Retry selectSlot: if no-view-found, the editor is mid-remount (yjsDocGeneration
        // incremented during recovery). Wait briefly for the new instance to attach cmView.
        let slotSelected = "no-view-found";
        for (let attempt = 0; attempt < 5; attempt++) {
          await editor.click();
          slotSelected = await selectSlot(currentPage, slotPlaceholder);
          if (slotSelected !== "no-view-found") break;
          await currentPage.waitForTimeout(300);
        }

        if (slotSelected === "ok") {
          await currentPage.keyboard.type(`[${username}] ${fragment}`, { delay: 150 });
          typeOk = true;
          console.log(`text-production:typed ${group.groupName} user=${username} ok=true`);
        } else {
          console.warn(`text-production:slot-not-found ${group.groupName} user=${username} slot=${slotPlaceholder} result=${slotSelected}`);
        }
      } catch (error) {
        console.warn(`text-production:type-failed ${group.groupName} user=${username} error=${error.message}`);
      }

      return { username, fragment, marker, chaosEvent: chaosType, typeOk };
    }),
  );

  // Wait for sync after all concurrent typing finishes
  await new Promise((resolve) => setTimeout(resolve, Math.max(createWaitMs * 2, 3000)));

  // Final convergence check: wait for all pages to stabilize
  const finalPages = getCurrentPages();
  console.log(`text-production:converge-wait ${group.groupName}`);
  const allMarkers = assignments.filter((_, i) => turnResults[i].typeOk).map((a) => a.marker);
  const convergence = await waitForPagesConverged(finalPages, allMarkers, `text-production:${group.groupName}`, scaledTimeout(20000));

  // Check which fragments survived on each page
  const finalContents = await Promise.all(finalPages.map((page) => getEditableContent(page)));
  const fragmentResults = assignments.map((assignment, idx) => {
    const { username, fragment, marker } = assignment;
    const chaosEvent = turnResults[idx].chaosEvent;
    const typed = turnResults[idx].typeOk;
    const presentOnPages = finalContents.map((content, pageIdx) => ({
      pageUser: memberUsernames[pageIdx],
      hasMarker: content.includes(marker),
      // Also check for the fragment text alone (in case marker delimiters got split)
      hasFragment: content.includes(fragment),
    }));
    const survivedOnAll = typed && presentOnPages.every((p) => p.hasMarker);
    const survivedOnSome = typed && presentOnPages.some((p) => p.hasMarker);
    return {
      username,
      fragment,
      marker,
      chaosEvent,
      typed,
      survivedOnAll,
      survivedOnSome,
      presentOnPages,
    };
  });

  // Detailed failure reporting
  const failures = fragmentResults.filter((r) => !r.survivedOnAll);
  if (failures.length > 0) {
    console.warn(`\ntext-production:FAILURES ${group.groupName} (${failures.length}/${fragmentResults.length} fragments lost)`);
    for (const f of failures) {
      if (!f.typed) {
        console.warn(`  BLOCKED: ${f.username} could not type at all (chaos: ${f.chaosEvent})`);
        console.warn(`    Fragment: "${f.fragment}"`);
      } else {
        const missingOn = f.presentOnPages.filter((p) => !p.hasMarker || !p.hasFragment);
        console.warn(`  LOST: ${f.username}'s fragment missing on ${missingOn.length}/${f.presentOnPages.length} pages (chaos: ${f.chaosEvent})`);
        console.warn(`    Fragment: "${f.fragment}"`);
        for (const m of missingOn) {
          console.warn(`    Missing on: ${m.pageUser} (marker: ${m.hasMarker}, text: ${m.hasFragment})`);
        }
      }
    }
  }

  // Show the intended vs actual document
  const intendedDocument = assignments.map((a) => `${a.marker}\n${a.fragment}`).join("\n");
  console.log(`\ntext-production:intended ${group.groupName}\n${intendedDocument}`);
  if (finalContents.length > 0) {
    const representativePage = finalContents[0];
    const actualFragmentSection = assignments
      .map((a) => {
        const hasMarker = representativePage.includes(a.marker);
        const hasText = representativePage.includes(a.fragment);
        const status = hasMarker && hasText ? "OK" : hasMarker ? "PARTIAL(marker only)" : hasText ? "PARTIAL(text only)" : "MISSING";
        return `  [${status}] ${a.username}: "${a.fragment.slice(0, 50)}..."`;
      })
      .join("\n");
    console.log(`text-production:actual ${group.groupName}\n${actualFragmentSection}`);
  }

  return {
    groupName: group.groupName,
    converged: convergence.ok,
    fragmentResults,
    totalFragments: fragmentResults.length,
    survivedAll: fragmentResults.filter((r) => r.survivedOnAll).length,
    typedOk: fragmentResults.filter((r) => r.typed).length,
    failures,
  };
}

async function verifyInstancesReset(group, contexts) {
  const owner = contexts[group.ownerIndex];
  const response = await owner.context.request.post(`${baseUrl}/api/games/${activeGameId}/instances/reset`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Failed to reset instances: ${response.status()} ${JSON.stringify(payload)}`);
  }

  await Promise.all(
    group.memberIndexes.map(async (memberIndex) => {
      const participant = contexts[memberIndex];
      await participant.page.waitForURL(
        (url) => !url.toString().includes(`groupId=${group.groupId}`),
        { timeout: scaledTimeout(20000) },
      );
    }),
  );

  const dbCount = await fetchGameInstanceCount(activeGameId);
  const memberResults = [];
  for (const memberIndex of group.memberIndexes) {
    const participant = contexts[memberIndex];
    const url = participant.page.url();
    const hasSelectGroup = (await participant.page.getByText("Select Group").count().catch(() => 0)) > 0;
    const hasPublicLobby = (await participant.page.getByText("Public Group Lobby").count().catch(() => 0)) > 0;
    const hasEditor = (await participant.page.locator(".cm-content[contenteditable='true']").count().catch(() => 0)) > 0;
    memberResults.push({
      username: participant.username,
      url,
      hasSelectGroup,
      hasPublicLobby,
      hasEditor,
      removedFromGroupRoute: !url.includes(`groupId=${group.groupId}`),
    });
  }

  const nonOwnerResults = memberResults.filter((entry) => entry.username !== owner.username);
  const kickedOut = nonOwnerResults.every(
    (entry) => entry.removedFromGroupRoute && !entry.hasEditor && (entry.hasSelectGroup || entry.hasPublicLobby),
  );
  const creatorLeftSharedRoute = memberResults
    .filter((entry) => entry.username === owner.username)
    .every((entry) => entry.removedFromGroupRoute);

  console.log(
    `stress:instances-reset ${group.groupName} deleted=${payload.deletedCount ?? "?"} invalidated=${payload.wsInvalidation?.invalidatedRoomCount ?? "?"} dbCount=${dbCount} kickedOut=${kickedOut} creatorLeftSharedRoute=${creatorLeftSharedRoute}`,
  );

  return {
    ok: dbCount === 0 && kickedOut && creatorLeftSharedRoute,
    memberResults,
  };
}

async function verifyCreatorGroupDetails(groups, contexts) {
  if (groups.length < 2) {
    throw new Error("creator_group_details scenario requires at least 2 groups");
  }

  const primaryGroup = groups[0];
  const sourceGroup = groups[1];
  const creator = contexts[primaryGroup.ownerIndex];
  const movedParticipant = contexts[sourceGroup.memberIndexes[0]];
  const removedParticipant = contexts[primaryGroup.memberIndexes[primaryGroup.memberIndexes.length - 1]];

  await gotoGamePage(creator.page, gameUrl(activeGameId), "creator-group-details");
  await creator.page.getByRole("button", { name: /creator/i }).waitFor({ timeout: scaledTimeout(20000) });
  await creator.page.getByRole("button", { name: /creator/i }).click();

  const primaryMemberLabel = contexts[primaryGroup.memberIndexes[0]].username;
  const groupMenuItem = creator.page.locator('[role="menuitem"]').filter({ hasText: primaryMemberLabel }).first();
  await groupMenuItem.waitFor({ timeout: scaledTimeout(10000) });
  await groupMenuItem.locator("button").click();

  const dialog = creator.page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: scaledTimeout(10000) });
  await dialog.getByPlaceholder("Enter email or exact name").waitFor({ timeout: scaledTimeout(10000) });

  const input = dialog.getByPlaceholder("Enter email or exact name");
  await input.fill(`dev+${movedParticipant.username}@local.test`);
  await dialog.getByRole("button", { name: /add \/ move/i }).click();
  const movedRow = dialog.locator("div.rounded-md.border.px-3.py-2").filter({ hasText: movedParticipant.username }).first();
  await movedRow.waitFor({ timeout: scaledTimeout(10000) });

  const removableRow = dialog.locator("div.rounded-md.border.px-3.py-2").filter({ hasText: removedParticipant.username }).first();
  await removableRow.waitFor({ timeout: scaledTimeout(10000) });
  await removableRow.locator("button").click();
  await removableRow.waitFor({ state: "detached", timeout: scaledTimeout(10000) });

  const primarySnapshot = await fetchGroupSnapshot(creator.context.request, primaryGroup);
  const sourceSnapshot = await fetchGroupSnapshot(creator.context.request, sourceGroup);

  const expectedPrimary = summarizeSet(
    primaryGroup.memberIndexes
      .slice(0, -1)
      .map((memberIndex) => contexts[memberIndex].username)
      .concat(movedParticipant.username),
  );
  const expectedSource = [];

  const primaryOk = JSON.stringify(summarizeSet(primarySnapshot.memberNames)) === JSON.stringify(expectedPrimary);
  const sourceOk = JSON.stringify(summarizeSet(sourceSnapshot.memberNames)) === JSON.stringify(expectedSource);

  console.log(
    `stress:creator-group-details primary=${primaryGroup.groupName} source=${sourceGroup.groupName} primaryOk=${primaryOk} sourceOk=${sourceOk}`,
  );

  return {
    ok: primaryOk && sourceOk,
    primarySnapshot,
    sourceSnapshot,
    expectedPrimary,
    expectedSource,
  };
}

async function submitGroupAttempt(group, contexts) {
  const owner = contexts[group.ownerIndex];
  const finishPayload = {
    points: 20,
    maxPoints: 20,
    pointsByLevel: {
      template: {
        points: 20,
        maxPoints: 20,
        accuracy: 100,
        bestTime: "0:10",
        scenarios: [],
      },
    },
    progressData: {
      submittedBy: owner.username,
      submittedAt: new Date().toISOString(),
      levels: [createStarterLevel()],
    },
  };
  const response = await owner.context.request.post(
    `${baseUrl}/api/games/${activeGameId}/finish?accessContext=game&groupId=${encodeURIComponent(group.groupId)}`,
    {
      data: finishPayload,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(`Failed to submit group ${group.groupName}: ${response.status()} ${JSON.stringify(payload)}`);
  }

  const attemptId = payload?.statistics?.attemptId ?? null;
  const participants = attemptId ? await fetchAttemptParticipants(attemptId) : [];
  const expectedNames = summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username));
  const actualNames = summarizeSet(participants);
  const submitOk = expectedNames.length === actualNames.length && expectedNames.every((value) => actualNames.includes(value));
  console.log(
    `stress:submit ${group.groupName} attemptId=${attemptId || "none"} expected=${expectedNames.join("|")} actual=${actualNames.join("|")} ok=${submitOk}`,
  );
  return {
    attemptId,
    expectedNames,
    actualNames,
    submitOk,
    finishPayload,
    statistics: payload.statistics ?? null,
  };
}

async function configureConsoleLogging(page, label) {
  page.on("console", (message) => {
    if (!verboseBrowserLogs) {
      return;
    }
    const text = message.text();
    const isYjsNoise =
      text.includes("[yjs-") ||
      text.includes("ws_yjs_protocol_emit") ||
      text.includes("yjs-protocol:apply") ||
      text.includes("yjs-sync:step1");
    if (
      (text.includes("[DEBUG-CLIENT]") && (!isYjsNoise || verboseYjsLogs)) ||
      (verboseYjsLogs && text.includes("[yjs-")) ||
      text.includes("shared_reset_") ||
      text.includes("ws_reset_room_") ||
      text.includes("group_join_") ||
      text.includes("finish_click") ||
      text.includes("room_resolution")
    ) {
      console.log(`[browser:${label}] ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    const message = error?.message || String(error);
    const stack = error?.stack ? `\n${error.stack}` : "";
    console.warn(`[browser:${label}:pageerror] ${message}${stack}`);
  });
  page.on("crash", () => {
    console.warn(`[browser:${label}:crash] page crashed`);
  });
  page.on("close", () => {
    console.warn(`[browser:${label}:close] page closed`);
  });
}

async function gotoGamePage(page, url, label) {
  const startedAt = Date.now();
  console.log(`nav:start ${label} url=${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  console.log(`nav:done ${label} ms=${Date.now() - startedAt} url=${page.url()}`);
}

async function reloadGamePage(page, label) {
  const startedAt = Date.now();
  console.log(`reload:start ${label} url=${page.url()}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  console.log(`reload:done ${label} ms=${Date.now() - startedAt} url=${page.url()}`);
}

async function waitForEditorOnPage(page, label) {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.locator(".cm-content").first().waitFor({ timeout: scaledTimeout(20000) });
      console.log(`editor:ready ${label}`);
      return;
    } catch (error) {
      await logPageEditorState(page, `${label}:editor-timeout`);
      if (attempt === maxAttempts) {
        throw error;
      }
      await reloadGamePage(page, `${label}:editor-retry`);
      await startGroupGame([page]);
    }
  }
}

async function applyLtiCookie(context, username, gameId) {
  const session = createLtiSession(username, gameId);
  await context.addCookies([
    {
      name: "lti_session",
      value: JSON.stringify(session),
      url: baseUrl,
      path: "/",
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);
}

function buildLtiLaunchPayload({ gameId, username, index, aplusGroup, consumerKey }) {
  const numericId = index + 1;
  const given = username.replace(/^user/i, "User ");
  const family = `Lti${String(numericId).padStart(2, "0")}`;
  return {
    custom_student_id: `PW-${String(numericId).padStart(3, "0")}`,
    lti_version: "LTI-1p0",
    lti_message_type: "basic-lti-launch-request",
    resource_link_id: `playwright-${gameId}`,
    resource_link_title: "UI-Designer",
    user_id: `pw-lti-${username}`,
    roles: "Learner,Student",
    lis_person_name_full: `${given} ${family}`,
    lis_person_name_given: given,
    lis_person_name_family: family,
    lis_person_contact_email_primary: `${username}@lti.local`,
    context_id: "playwright/def/current/",
    context_title: "Playwright Def. Course",
    context_label: "PWLTI",
    launch_presentation_locale: "en",
    launch_presentation_document_target: "iframe",
    launch_presentation_return_url: `${baseUrl}/playwright/return`,
    tool_consumer_instance_guid: "playwright/aplus",
    tool_consumer_instance_name: "A+",
    tool_consumer_instance_description: "Playwright A+",
    tool_consumer_instance_url: baseUrl,
    custom_context_api: `${baseUrl}/api/playwright/context`,
    custom_context_api_id: "1",
    custom_user_api_token: "playwright-token",
    lis_result_sourcedid: `${gameId}-${username}`,
    lis_outcome_service_url: `${baseUrl}/api/playwright/lti-outcomes`,
    oauth_nonce: `${Date.now()}-${username}`,
    oauth_timestamp: `${Math.floor(Date.now() / 1000)}`,
    oauth_version: "1.0",
    oauth_signature_method: "HMAC-SHA1",
    oauth_consumer_key: consumerKey,
    oauth_signature: "playwright-signature",
    _aplus_group: aplusGroup,
  };
}

async function launchThroughLtiPost(page, gameId, payload) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    async ({ action, payload: formPayload }) => {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = action;
      for (const [key, value] of Object.entries(formPayload)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    },
    {
      action: `${baseUrl}/api/lti/game/${gameId}`,
      payload,
    },
  );
  await page.waitForURL((url) => url.pathname === `/game/${gameId}` && Boolean(url.searchParams.get("groupId")), {
    timeout: scaledTimeout(30000),
  });
}

async function fetchPageGroupId(page) {
  const current = new URL(page.url());
  return current.searchParams.get("groupId");
}

async function captureWaitingRoomIdentity(page, expectedLabels) {
  await page.getByText("Group Waiting Room").waitFor({ timeout: scaledTimeout(20000) });
  await page.waitForFunction((labels) => {
    const bodyText = document.body.innerText || "";
    const titles = Array.from(document.querySelectorAll("[title]"))
      .map((element) => element.getAttribute("title") || "")
      .filter(Boolean)
      .map((title) => title.replace(/\s+•\s+Ready$/, ""));
    return labels.every((label) => bodyText.includes(label) && titles.includes(label));
  }, expectedLabels, { timeout: scaledTimeout(10000) });
  const snapshot = await page.evaluate((labels) => {
    const bodyText = document.body.innerText || "";
    const titles = Array.from(document.querySelectorAll("[title]"))
      .map((element) => element.getAttribute("title") || "")
      .filter(Boolean);
    const normalizedTitles = titles.map((title) => title.replace(/\s+•\s+Ready$/, ""));
    return {
      visibleLabels: labels.filter((label) => bodyText.includes(label)),
      avatarLabels: labels.filter((label) => normalizedTitles.includes(label)),
      rawTitles: titles,
    };
  }, expectedLabels);

  return {
    visibleLabels: summarizeSet(snapshot.visibleLabels),
    avatarLabels: summarizeSet(snapshot.avatarLabels),
    rawTitles: snapshot.rawTitles,
  };
}

async function runLtiAplusGroupScenario(browser) {
  const creatorContext = await browser.newContext({ baseURL: baseUrl, viewport: smokeViewport });
  await enableHttpLatency(creatorContext);
  const creatorPage = await creatorContext.newPage();
  if (requestedGameId) {
    activeGameId = requestedGameId;
    console.log(`using existing game ${activeGameId}`);
  } else {
    await signInDevUser(creatorPage, "creator");
    const createdGame = await createGroupModeGame(creatorContext.request, "creator");
    activeGameId = createdGame.gameId;
    console.log(`created game ${activeGameId} (${createdGame.title})`);
  }

  const consumerKey = await fetchLtiConsumerKey();
  if (!consumerKey) {
    throw new Error("No LTI consumer key found in local database.");
  }
  await ensureLtiCredential(consumerKey, "dev+creator@local.test");

  const contexts = [];
  const summary = [];

  try {
    for (const [index, username] of usernames.entries()) {
      const context = await browser.newContext({ baseURL: baseUrl, viewport: smokeViewport });
      await enableHttpLatency(context);
      const page = await context.newPage();
      await enableWsReceiveDelay(page);
      await configureConsoleLogging(page, username);
      const layoutIndex = groupLayouts.findIndex((layout) => layout.includes(index));
      const aplusGroup = String(Math.max(layoutIndex, 0));
      contexts.push({
        username,
        context,
        page,
        aplusGroup,
        expectedDisplayName: expectedLtiDisplayName(username, index),
      });
      const payload = buildLtiLaunchPayload({ gameId: activeGameId, username, index, aplusGroup, consumerKey });
      await launchThroughLtiPost(page, activeGameId, payload);
      const pageGroupId = await fetchPageGroupId(page);
      console.log(`lti:launch ${username} aplusGroup=${aplusGroup} appGroupId=${pageGroupId}`);
    }

    const groups = [];
    for (const [layoutIndex, memberIndexes] of groupLayouts.entries()) {
      const ownerIndex = memberIndexes[0];
      const owner = contexts[ownerIndex];
      const groupId = await fetchPageGroupId(owner.page);
      if (!groupId) {
        throw new Error(`No groupId in redirected URL for ${owner.username}`);
      }
      groups.push({
        aplusGroup: String(layoutIndex),
        groupId,
        groupName: `A+ Group ${layoutIndex}`,
        memberIndexes,
        ownerIndex,
      });
    }

    for (const group of groups) {
      const pageGroupIds = await Promise.all(
        group.memberIndexes.map((memberIndex) => fetchPageGroupId(contexts[memberIndex].page)),
      );
      const uniqueGroupIds = [...new Set(pageGroupIds.filter(Boolean))];
      if (uniqueGroupIds.length !== 1 || uniqueGroupIds[0] !== group.groupId) {
        throw new Error(`Expected one redirected app group for A+ group ${group.aplusGroup}, got ${uniqueGroupIds.join(", ")}`);
      }
      group.joinSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(
        `lti:join-snapshot aplusGroup=${group.aplusGroup} groupId=${group.groupId} members=${group.joinSnapshot.memberNames.join("|")}`,
      );
      const expectedLabels = group.memberIndexes.map(
        (memberIndex) => contexts[memberIndex].expectedDisplayName,
      );
      const waitingSnapshots = [];
      for (const memberIndex of group.memberIndexes) {
        const participant = contexts[memberIndex];
        const waitingSnapshot = await captureWaitingRoomIdentity(participant.page, expectedLabels);
        waitingSnapshots.push(waitingSnapshot);
        console.log(
          `lti:identity ${participant.username} aplusGroup=${group.aplusGroup} visible=${waitingSnapshot.visibleLabels.join("|")} avatars=${waitingSnapshot.avatarLabels.join("|")}`,
        );
      }
      const expectedNormalized = summarizeSet(expectedLabels);
      const namesPreserved = waitingSnapshots.every((snapshot) => {
        const visible = summarizeSet(snapshot.visibleLabels);
        const avatars = summarizeSet(snapshot.avatarLabels);
        return visible.length === expectedNormalized.length &&
          avatars.length === expectedNormalized.length &&
          expectedNormalized.every((label) => visible.includes(label) && avatars.includes(label));
      });
      summary.push({
        name: `aplus-${group.aplusGroup}`,
        members: group.joinSnapshot.memberCount,
        groupId: group.groupId,
        namesPreserved,
        expectedMembers: expectedNormalized,
        observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
        observedVisibleNames: summarizeSet(waitingSnapshots.flatMap((snapshot) => snapshot.visibleLabels)),
        observedAvatarNames: summarizeSet(waitingSnapshots.flatMap((snapshot) => snapshot.avatarLabels)),
      });
    }

    console.log("");
    console.log(`Playwright scenario: ${scenario}`);
    console.log(`Game: ${activeGameId}`);
    console.log("Summary");
    console.log("group | members | groupId | names");
    for (const row of summary) {
      console.log(
        `${row.name} | ${row.members} | ${row.groupId || "none"} | ${row.namesPreserved ? "PASS" : "FAIL"}`,
      );
      console.log(
        `summary:${row.name} expected=${row.expectedMembers.join("|")} join=${row.observedJoinMembers.join("|")} visible=${row.observedVisibleNames.join("|")} avatars=${row.observedAvatarNames.join("|")}`,
      );
    }
    const allPassed = summary.every((row) => row.namesPreserved);
    printRunSummary(scenario, allPassed, Object.fromEntries(
      summary.map((row) => [`${row.name}-names`, row.namesPreserved])
    ));
  } finally {
    await Promise.all(contexts.map(async ({ context }) => context.close().catch(() => {})));
    await creatorContext.close().catch(() => {});
  }
}

async function openLtiLobby(page, gameId, username) {
  await gotoGamePage(page, gameUrl(gameId, null), `lti-lobby:${username}`);
  await page.getByText("Public Group Lobby").waitFor({ timeout: scaledTimeout(20000) });
  const data = await page.evaluate(async () => {
    const res = await fetch("/api/games/lti-session");
    return res.json();
  });
  const roomId = `lobby:${encodeURIComponent(data.contextId || data.courseName || "unresolved-lti-group")}:game:${gameId}`;
  console.log(`lti:lobby ${username} gameId=${gameId} roomId=${roomId}`);
  return { roomId, ltiInfo: data };
}

async function closeAndReopenMember(group, contexts, memberIndex) {
  const participant = contexts[memberIndex];
  await participant.page.close().catch(() => {});
  participant.page = await participant.context.newPage();
  await enableWsReceiveDelay(participant.page);
  await configureConsoleLogging(participant.page, participant.username);
  await gotoGamePage(participant.page, gameUrl(activeGameId, group.groupId), `rejoin:${participant.username}`);
  await waitForEditorOnPage(participant.page, `rejoin:${participant.username}`);
  console.log(`stress:rejoin ${group.groupName} user=${participant.username}`);
}

async function main() {
  if (scenario === "ws_invalid_rsv1") {
    await runInvalidRsv1Scenario();
    return;
  }

  const browserType = resolveBrowserType(browserName);
  console.log(`browser:type ${browserName}`);
  const browser = await browserType.launch({ headless: !headed, slowMo: headed ? 120 : 0 });

  if (scenario === "ws_recovery") {
    try {
      await runWsRecoveryScenario(browser);
    } finally {
      await browser.close().catch(() => {});
    }
    return;
  }

  if (scenario === "refresh_desync") {
    try {
      await runRefreshDesyncScenario(browser);
    } finally {
      await browser.close().catch(() => {});
    }
    return;
  }

  if (scenario === "lti_aplus_group") {
    try {
      await runLtiAplusGroupScenario(browser);
    } finally {
      await browser.close().catch(() => {});
    }
    return;
  }

  const contexts = [];
  const summary = [];

  try {
    for (let userIdx = 0; userIdx < usernames.length; userIdx++) {
      const username = usernames[userIdx];
      const context = await browser.newContext({ baseURL: baseUrl, viewport: smokeViewport });
      await enableHttpLatency(context);
      const page = await context.newPage();
      await enableWsReceiveDelay(page);
      await configureConsoleLogging(page, username);
      contexts.push({ username, context, page, extraPages: [] });
      await signInDevUser(page, username);
      console.log(`signed in ${username}`);
    }

    const creator = contexts[0];
    let provisionedTitle = null;
    let primaryGroup;

    if (requestedGameId) {
      const createdGroup = await createGroup(creator.context.request, creator.username, requestedGameId, "group-a");
      activeGameId = requestedGameId;
      primaryGroup = createdGroup;
    } else {
      const createdGame = scenario === "level_tab_switch"
        ? await createPlayableTwoLevelGroupGame(creator.context.request, creator.username)
        : await createPlayableGroupGame(creator.context.request, creator.username);
      activeGameId = createdGame.gameId;
      provisionedTitle = createdGame.title;
      primaryGroup = createdGame;
    }

    if (flags.useLtiLobby) {
      for (const participant of contexts) {
        await applyLtiCookie(participant.context, participant.username, activeGameId);
        const lobby = await openLtiLobby(participant.page, activeGameId, participant.username);
        participant.ltiLobby = lobby;
      }
      const uniqueLobbyRooms = [...new Set(contexts.map((participant) => participant.ltiLobby?.roomId || ""))];
      if (uniqueLobbyRooms.length !== 1) {
        throw new Error(`Expected one shared LTI lobby room, got ${uniqueLobbyRooms.join(", ")}`);
      }
      if (flags.refreshDuringLobby) {
        await reloadGamePage(contexts[0].page, `lti-lobby-reload:${contexts[0].username}`);
        await contexts[0].page.getByText("Public Group Lobby").waitFor({ timeout: scaledTimeout(20000) });
        console.log(`stress:lobby-reload user=${contexts[0].username}`);
      }
    }

    console.log(`created group ${primaryGroup.groupName} (${primaryGroup.groupId}) with join key ${primaryGroup.joinKey}`);
    if (provisionedTitle) {
      console.log(`created game ${activeGameId} (${provisionedTitle})`);
    }

    const groups = [
      {
        groupId: primaryGroup.groupId,
        groupName: primaryGroup.groupName,
        joinKey: primaryGroup.joinKey,
        memberIndexes: groupLayouts[0],
        ownerIndex: groupLayouts[0][0],
      },
    ];

    for (let groupIndex = 1; groupIndex < groupLayouts.length; groupIndex += 1) {
      const ownerIndex = groupLayouts[groupIndex][0];
      const owner = contexts[ownerIndex];
      const suffix = `group-${String.fromCharCode(97 + groupIndex)}`;
      const createdGroup = await createGroup(owner.context.request, owner.username, activeGameId, suffix);
      await seedGroupInstance(owner.context.request, activeGameId, createdGroup.groupId, suffix);
      groups.push({
        groupId: createdGroup.groupId,
        groupName: createdGroup.groupName,
        joinKey: createdGroup.joinKey,
        memberIndexes: groupLayouts[groupIndex],
        ownerIndex,
      });
      console.log(`created group ${createdGroup.groupName} (${createdGroup.groupId}) with join key ${createdGroup.joinKey}`);
    }

    // For text production: re-seed all groups with slotted levels
    if (scenario === "classroom_text_production") {
      for (const group of groups) {
        const slotCount = group.memberIndexes.length;
        const owner = contexts[group.ownerIndex];
        await seedTextProductionInstance(owner.context.request, activeGameId, group.groupId, group.groupName, slotCount);
        console.log(`text-production:seeded ${group.groupName} with ${slotCount} slots`);
      }
    }

    for (const group of groups) {
      for (const memberIndex of group.memberIndexes.slice(1)) {
        const participant = contexts[memberIndex];
        if (flags.delayedJoinMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, flags.delayedJoinMs));
        }
        await joinGroup(participant.context.request, group.groupId, group.joinKey, participant.username);
        console.log(`joined ${participant.username} -> ${group.groupId}`);
      }
      group.joinSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(`stress:join-snapshot ${group.groupName} memberCount=${group.joinSnapshot.memberCount} members=${group.joinSnapshot.memberNames.join("|")}`);
    }

    const initialGameGroups = await fetchGameGroupsSnapshot(creator.context.request);
    console.log(`stress:game-groups initialCount=${initialGameGroups.length}`);

    for (const group of groups) {
      const instanceIds = [];
      for (const memberIndex of group.memberIndexes) {
        const participant = contexts[memberIndex];
        const instanceId = await resolveSharedInstance(participant.context.request, participant.username, group.groupId);
        instanceIds.push(instanceId);
        console.log(`instance ${participant.username} in ${group.groupName}: ${instanceId}`);
      }
      const unique = [...new Set(instanceIds.filter(Boolean))];
      if (unique.length !== 1) {
        throw new Error(`Expected one shared instance for ${group.groupName}, got ${unique.join(", ") || "none"}`);
      }
      group.instanceId = unique[0];
    }

    for (const group of groups) {
      const lateOpenIndexes = flags.lateOpenCount > 0 && group.memberIndexes.length > 2
        ? group.memberIndexes.slice(-flags.lateOpenCount)
        : [];
      group.lateOpenIndexes = lateOpenIndexes;
      group.evictedOriginalIndexes = [];
      for (const memberIndex of group.memberIndexes) {
        if (lateOpenIndexes.includes(memberIndex)) {
          continue;
        }
        const participant = contexts[memberIndex];
        await gotoGamePage(participant.page, gameUrl(activeGameId, group.groupId), `group-open:${participant.username}`);
        console.log(`opened group route for ${participant.username} -> ${group.groupName}`);
      }
      // After all initial pages open, detect eviction modals caused by duplicate usernames.
      // Due to WS connection timing, either the earlier or later duplicate might get evicted.
      const initialNonLateIndexes = group.memberIndexes.filter((idx) => !lateOpenIndexes.includes(idx));
      const duplicateUsernames = new Set();
      const seenUsernames = new Set();
      for (const idx of initialNonLateIndexes) {
        const u = contexts[idx].username;
        if (seenUsernames.has(u)) duplicateUsernames.add(u);
        seenUsernames.add(u);
      }
      if (duplicateUsernames.size > 0) {
        // Give WS connections time to establish and eviction to propagate
        await contexts[initialNonLateIndexes[0]].page.waitForTimeout(2000);
        for (const idx of initialNonLateIndexes) {
          if (!duplicateUsernames.has(contexts[idx].username)) continue;
          const evictionHeading = contexts[idx].page.getByRole("heading", { name: "Duplicate session detected" });
          const isEvicted = await evictionHeading.isVisible().catch(() => false);
          if (isEvicted) {
            console.log(`eviction:initial-open ${group.groupName} user=${contexts[idx].username} idx=${idx}`);
            await dismissEvictionModalReadOnly(contexts[idx].page, `${group.groupName}:${contexts[idx].username}:initial`);
            group.evictedOriginalIndexes.push(idx);
          }
        }
      }
    }

    if (flags.refreshDuringWaiting && routeKind !== "prototype-yjs") {
      for (const group of groups) {
        const reloadIndex = group.memberIndexes.find((index) => !group.lateOpenIndexes.includes(index));
        if (reloadIndex != null) {
          await reloadGamePage(contexts[reloadIndex].page, `waiting-reload:${contexts[reloadIndex].username}`);
          console.log(`stress:waiting-reload ${group.groupName} user=${contexts[reloadIndex].username}`);
        }
      }
    }

    if (scenario === "creator_group_details") {
      const result = await verifyCreatorGroupDetails(groups, contexts);
      summary.push({
        name: groups[0].groupName,
        members: result.primarySnapshot.memberCount,
        expectedMembers: result.expectedPrimary,
        observedJoinMembers: summarizeSet(groups[0].joinSnapshot.memberNames),
        observedStartMembers: summarizeSet(groups[0].joinSnapshot.memberNames),
        observedFinishMembers: summarizeSet(result.primarySnapshot.memberNames),
        instanceId: groups[0].instanceId || "none",
        singleEdit: result.ok,
        concurrent: result.ok,
        stressPasses: result.ok ? 1 : 0,
        stressTotal: 1,
        resetOk: result.ok,
        submitOk: null,
        actualSubmitParticipants: [],
      });
      summary.push({
        name: groups[1].groupName,
        members: result.sourceSnapshot.memberCount,
        expectedMembers: result.expectedSource,
        observedJoinMembers: summarizeSet(groups[1].joinSnapshot.memberNames),
        observedStartMembers: summarizeSet(groups[1].joinSnapshot.memberNames),
        observedFinishMembers: summarizeSet(result.sourceSnapshot.memberNames),
        instanceId: groups[1].instanceId || "none",
        singleEdit: result.ok,
        concurrent: result.ok,
        stressPasses: result.ok ? 1 : 0,
        stressTotal: 1,
        resetOk: result.ok,
        submitOk: null,
        actualSubmitParticipants: [],
      });

      const finalGameGroups = await fetchGameGroupsSnapshot(creator.context.request);
      console.log(`stress:game-groups finalCount=${finalGameGroups.length}`);
      console.log("");
      console.log(`Playwright scenario: ${scenario}`);
      console.log(`Game: ${activeGameId}`);
      console.log("Summary");
      console.log("group | members | instance | single | concurrent | stress | reset | submit");
      for (const row of summary) {
        console.log(
          `${row.name} | ${row.members} | ${row.instanceId || "none"} | ${row.singleEdit ? "PASS" : "FAIL"} | ${row.concurrent ? "PASS" : "FAIL"} | ${row.stressPasses}/${row.stressTotal} | ${row.resetOk ? "PASS" : "FAIL"} | ${row.submitOk == null ? "n/a" : row.submitOk ? "PASS" : "FAIL"}`,
        );
        console.log(
          `summary:${row.name} expected=${row.expectedMembers.join("|")} join=${row.observedJoinMembers.join("|")} start=${row.observedStartMembers.join("|")} finish=${row.observedFinishMembers.join("|")} submit=${row.actualSubmitParticipants.join("|")}`,
        );
      }
      const allPassed = summary.every((row) =>
        row.singleEdit && row.concurrent && row.resetOk && (row.submitOk == null || row.submitOk)
      );
      printRunSummary(scenario, allPassed, Object.fromEntries(
        summary.flatMap((row) => [
          [`${row.name}-single`, row.singleEdit],
          [`${row.name}-concurrent`, row.concurrent],
          [`${row.name}-reset`, row.resetOk],
        ])
      ));
      return;
    }

    for (const group of groups) {
      const activePages = group.memberIndexes
        .filter((memberIndex) => !group.lateOpenIndexes.includes(memberIndex) && !(group.evictedOriginalIndexes || []).includes(memberIndex))
        .map((memberIndex) => contexts[memberIndex].page);
      await startGroupGame(activePages);
      if ((scenario === "same_user_duplicate" || scenario === "same_user_blocked") && group.lateOpenIndexes.length > 0) {
        await waitForEditorOnPages(activePages);
      }
      group.blockedLateIndexes = [];
      group.duplicateBlockedModalOk = true;
      for (const lateIndex of group.lateOpenIndexes) {
        const participant = contexts[lateIndex];
        // Find the original (already-open) page with the same username
        // that will be evicted when the late duplicate connects.
        const originalIndex = (scenario === "same_user_blocked" || scenario === "same_user_duplicate")
          ? group.memberIndexes.find((idx) =>
              idx !== lateIndex &&
              !group.lateOpenIndexes.includes(idx) &&
              contexts[idx].username === participant.username)
          : undefined;
        await gotoGamePage(participant.page, gameUrl(activeGameId, group.groupId), `late-open:${participant.username}`);
        console.log(`stress:late-open ${group.groupName} user=${participant.username}`);
        if (scenario === "same_user_blocked" && originalIndex !== undefined) {
          // The server evicts the ORIGINAL socket, so check the original page for the eviction modal
          await verifyEvictionModal(contexts[originalIndex].page, `${group.groupName}:${contexts[originalIndex].username}:evicted`);
          await dismissEvictionModalReadOnly(contexts[originalIndex].page, `${group.groupName}:${contexts[originalIndex].username}`);
          group.evictedOriginalIndexes.push(originalIndex);
        } else if (scenario === "same_user_duplicate" && originalIndex !== undefined) {
          // The server evicts the ORIGINAL socket; send it to read-only so the late opener is active
          await verifyEvictionModal(contexts[originalIndex].page, `${group.groupName}:${contexts[originalIndex].username}:evicted`);
          await dismissEvictionModalReadOnly(contexts[originalIndex].page, `${group.groupName}:${contexts[originalIndex].username}`);
          group.evictedOriginalIndexes.push(originalIndex);
        }
      }
      // For same_user_blocked: evicted originals are now read-only, late openers are active.
      // Active members exclude the evicted originals.
      group.activeMemberIndexes = group.memberIndexes.filter(
        (memberIndex) => !group.blockedLateIndexes.includes(memberIndex) && !group.evictedOriginalIndexes.includes(memberIndex)
      );
      await waitForEditorOnPages(group.activeMemberIndexes.map((memberIndex) => contexts[memberIndex].page));
      group.startSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(`stress:start-snapshot ${group.groupName} memberCount=${group.startSnapshot.memberCount} members=${group.startSnapshot.memberNames.join("|")}`);
    }

    for (let index = 0; index < Math.min(flags.openExtraTabCount, groups.length); index += 1) {
      const group = groups[index];
      const participant = contexts[group.ownerIndex];
      const extraPage = await participant.context.newPage();
      await enableWsReceiveDelay(extraPage);
      await configureConsoleLogging(extraPage, `${participant.username}-tab2`);
      await gotoGamePage(extraPage, gameUrl(activeGameId, group.groupId), `extra-tab:${participant.username}`);
      if (!isInGameFocusedScenario()) {
        await startGroupGame([extraPage]);
      }
      try {
        await waitForEditorOnPage(extraPage, `extra-tab:${participant.username}`);
      } catch (error) {
        const waitingRoomCount = await extraPage.getByText("Group Waiting Room").count().catch(() => 0);
        if (waitingRoomCount > 0) {
          throw error;
        }
        console.warn(`stress:extra-tab-no-editor ${group.groupName} user=${participant.username}`);
      }
      participant.extraPages.push(extraPage);
      console.log(`stress:extra-tab ${group.groupName} user=${participant.username}`);
      // Opening the extra tab evicts the main page. Reclaim the main page so it stays active.
      const mainEvictionHeading = participant.page.getByRole("heading", { name: "Duplicate session detected" });
      try {
        await mainEvictionHeading.waitFor({ timeout: scaledTimeout(5000) });
        await participant.page.keyboard.press("Enter");
        console.log(`stress:extra-tab:reclaimed-main ${group.groupName} user=${participant.username}`);
        // Wait for the main page editor to be ready again after reclaim
        await participant.page.locator(".cm-content").first().waitFor({ timeout: scaledTimeout(10000) });
      } catch {
        // No eviction on main page — might already be handled
      }
    }

    for (const group of groups) {
      const participantIndexes = group.activeMemberIndexes ?? group.memberIndexes;
      const pages = participantIndexes.map((memberIndex) => contexts[memberIndex].page);

      if (scenario === "level_tab_switch") {
        const levelTabOk = await verifyLevelAndTabIsolation(group, contexts);
        console.log(`stress:level-tab ${group.groupName} ok=${levelTabOk}`);
        summary.push({
          name: group.groupName,
          members: group.memberIndexes.length,
          expectedMembers: summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username)),
          observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
          observedStartMembers: summarizeSet(group.startSnapshot.memberNames),
          observedFinishMembers: summarizeSet(group.startSnapshot.memberNames),
          instanceId: group.instanceId || "none",
          singleEdit: levelTabOk,
          concurrent: levelTabOk,
          stressPasses: levelTabOk ? 1 : 0,
          stressTotal: 1,
          resetOk: true,
          submitOk: null,
          actualSubmitParticipants: [],
        });
        continue;
      }

      if (scenario === "classroom_text_production") {
        // Handled after this loop — all groups run in parallel
        continue;
      }

      if (scenario === "instances_reset") {
        const resetInstancesOk = await verifyInstancesReset(group, contexts);
        summary.push({
          name: group.groupName,
          members: group.memberIndexes.length,
          expectedMembers: summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username)),
          observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
          observedStartMembers: summarizeSet(group.startSnapshot.memberNames),
          observedFinishMembers: summarizeSet(group.startSnapshot.memberNames),
          instanceId: group.instanceId || "none",
          singleEdit: resetInstancesOk.ok,
          concurrent: resetInstancesOk.ok,
          stressPasses: resetInstancesOk.ok ? 1 : 0,
          stressTotal: 1,
          resetOk: resetInstancesOk.ok,
          submitOk: null,
          actualSubmitParticipants: [],
        });
        continue;
      }

      if (scenario === "same_user_blocked") {
        const marker = `pw-${group.groupName}-${Date.now().toString(36)}`;
        const replicated = await trySharedEdit(pages, marker);
        const concurrentReplicated = await tryConcurrentSharedEdit(pages, group.groupName);
        const samePositionReplicated = await trySamePositionConcurrentEdit(pages, `${group.groupName}-same-position`);
        console.log(`stress:duplicate-blocked ${group.groupName} ok=${group.duplicateBlockedModalOk}`);
        summary.push({
          name: group.groupName,
          members: group.startSnapshot.memberCount,
          expectedMembers: summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username)),
          observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
          observedStartMembers: summarizeSet(group.startSnapshot.memberNames),
          observedFinishMembers: summarizeSet(group.startSnapshot.memberNames),
          instanceId: group.instanceId || "none",
          singleEdit: replicated && group.duplicateBlockedModalOk,
          concurrent: concurrentReplicated && samePositionReplicated && group.duplicateBlockedModalOk,
          stressPasses: group.duplicateBlockedModalOk ? 1 : 0,
          stressTotal: 1,
          resetOk: group.duplicateBlockedModalOk,
          submitOk: null,
          actualSubmitParticipants: [],
        });
        continue;
      }

      const marker = `pw-${group.groupName}-${Date.now().toString(36)}`;
      const replicated = await trySharedEdit(pages, marker);
      if (replicated) {
        console.log(`shared edit marker replicated in ${group.groupName}: ${marker}`);
      } else {
        console.warn(`shared edit marker was not observed remotely in ${group.groupName}: ${marker}`);
      }

      const concurrentReplicated = await tryConcurrentSharedEdit(pages, group.groupName);
      if (concurrentReplicated) {
        console.log(`concurrent edit markers merged in ${group.groupName}`);
      } else {
        console.warn(`concurrent edit markers did not merge cleanly in ${group.groupName}`);
      }
      const samePositionReplicated = await trySamePositionConcurrentEdit(pages, `${group.groupName}-same-position`);
      if (samePositionReplicated) {
        console.log(`same-position concurrent edits converged in ${group.groupName}`);
      } else {
        console.warn(`same-position concurrent edits did not converge in ${group.groupName}`);
      }

      const stressResults = [];
      const memberPages = participantIndexes.map((memberIndex) => contexts[memberIndex].page);
      const memberNames = participantIndexes.map((memberIndex) => contexts[memberIndex].username);
      console.log(`stress:start ${group.groupName} members=${memberNames.join(",")}`);

      for (let round = 1; round <= flags.stressRounds; round += 1) {
        const concurrentOk = await tryConcurrentSharedEdit(memberPages, `${group.groupName}-round-${round}`);
        stressResults.push(concurrentOk);
        console.log(`stress:round ${group.groupName} round=${round} concurrentOk=${concurrentOk}`);

        if (flags.refreshDuringEditing && memberPages.length >= 3 && round === 1) {
          const reloaderPage = memberPages[memberPages.length - 1];
          await reloadGamePage(reloaderPage, `edit-reload:${memberNames[memberNames.length - 1]}`);
          await waitForEditorOnPage(reloaderPage, `edit-reload:${memberNames[memberNames.length - 1]}`);
          console.log(`stress:reload ${group.groupName} user=${memberNames[memberNames.length - 1]}`);
        }
      }

      // Edit-stability check: verify typed content is NOT reverted by recovery cycles.
      // Starts dropping Yjs updates on a non-typing user so the typing user's edits
      // don't reach them → their hashes diverge → server fires divergence_detected →
      // the typing user's client runs replaceLocalYDoc recovery.
      let editStable = null;
      if (flags.wsReceiveDelayMs > 0 || flags.wsDropYjsUpdates > 0) {
        const typingIdx = participantIndexes[0];
        const typingPage = contexts[typingIdx].page;
        // Start dropping on the typing user's page so they don't receive remote updates
        // This creates a genuine hash divergence from the server's perspective
        const stabilityResult = await tryEditStability(typingPage, memberPages, group.groupName, { droppingPage: typingPage });
        stopDroppingYjsUpdates(typingPage);
        editStable = stabilityResult.stable;
      }

      if (flags.closeReopenCount > 0 && participantIndexes.length > 1) {
        const memberIndex = participantIndexes[participantIndexes.length - 1];
        await closeAndReopenMember(group, contexts, memberIndex);
      }

      const finishSnapshot = await fetchGroupSnapshot(contexts[group.ownerIndex].context.request, group);
      console.log(`stress:finish-snapshot ${group.groupName} memberCount=${finishSnapshot.memberCount} members=${finishSnapshot.memberNames.join("|")}`);

      const resetOk = await verifyLevelReset(group, contexts);
      console.log(`stress:reset ${group.groupName} ok=${resetOk}`);

      let submitResult = null;
      if (flags.submitAfterStress) {
        submitResult = await submitGroupAttempt(group, contexts);
      }

      const instanceState = await fetchInstanceState(activeGameId, group.groupId);
      summary.push({
        name: group.groupName,
        members: finishSnapshot.memberCount,
        expectedMembers: summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username)),
        observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
        observedStartMembers: summarizeSet(group.startSnapshot.memberNames),
        observedFinishMembers: summarizeSet(finishSnapshot.memberNames),
        instanceId: group.instanceId || (instanceState?.id ?? null),
        singleEdit: replicated,
        concurrent: concurrentReplicated && samePositionReplicated,
        stressPasses: stressResults.filter(Boolean).length,
        stressTotal: stressResults.length,
        resetOk,
        editStable,
        submitOk: submitResult?.submitOk ?? null,
        actualSubmitParticipants: submitResult?.actualNames ?? [],
      });
    }

    // Text production: run ALL groups in parallel so the whole classroom types at once
    if (scenario === "classroom_text_production") {
      console.log(`text-production:all-groups-start (${groups.length} groups in parallel)`);
      const textResults = await Promise.all(
        groups.map((group) => runTextProductionForGroup(group, contexts)),
      );
      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const textResult = textResults[i];
        const allOk = textResult.survivedAll === textResult.totalFragments;
        summary.push({
          name: group.groupName,
          members: group.memberIndexes.length,
          expectedMembers: summarizeSet(group.memberIndexes.map((memberIndex) => contexts[memberIndex].username)),
          observedJoinMembers: summarizeSet(group.joinSnapshot.memberNames),
          observedStartMembers: summarizeSet(group.startSnapshot.memberNames),
          observedFinishMembers: summarizeSet(group.startSnapshot.memberNames),
          instanceId: group.instanceId || "none",
          singleEdit: allOk,
          concurrent: textResult.converged,
          stressPasses: textResult.survivedAll,
          stressTotal: textResult.totalFragments,
          resetOk: allOk,
          submitOk: null,
          actualSubmitParticipants: [],
          textProduction: textResult,
        });
      }
    }

    const finalGameGroups = await fetchGameGroupsSnapshot(creator.context.request);
    console.log(`stress:game-groups finalCount=${finalGameGroups.length}`);

    console.log("");
    console.log(`Playwright scenario: ${scenario}`);
    console.log(`Game: ${activeGameId}`);
    console.log("Summary");
    console.log("group | members | instance | single | concurrent | stress | reset | stable | submit");
    for (const row of summary) {
      const stableCol = row.editStable == null ? "n/a" : row.editStable ? "PASS" : "FAIL";
      console.log(
        `${row.name} | ${row.members} | ${row.instanceId || "none"} | ${row.singleEdit ? "PASS" : "FAIL"} | ${row.concurrent ? "PASS" : "FAIL"} | ${row.stressPasses}/${row.stressTotal} | ${row.resetOk ? "PASS" : "FAIL"} | ${stableCol} | ${row.submitOk == null ? "n/a" : row.submitOk ? "PASS" : "FAIL"}`,
      );
      console.log(
        `summary:${row.name} expected=${row.expectedMembers.join("|")} join=${row.observedJoinMembers.join("|")} start=${row.observedStartMembers.join("|")} finish=${row.observedFinishMembers.join("|")} submit=${row.actualSubmitParticipants.join("|")}`,
      );
    }

    if (scenario !== "classroom_text_production") {
      const allPassed = summary.every((row) =>
        row.singleEdit && row.concurrent &&
        row.stressPasses === row.stressTotal &&
        row.resetOk &&
        (row.editStable == null || row.editStable) &&
        (row.submitOk == null || row.submitOk)
      );
      printRunSummary(scenario, allPassed, Object.fromEntries(
        summary.flatMap((row) => [
          [`${row.name}-single`, row.singleEdit],
          [`${row.name}-concurrent`, row.concurrent],
          [`${row.name}-stress`, row.stressPasses === row.stressTotal],
          [`${row.name}-reset`, row.resetOk],
        ])
      ));
    }

    if (scenario === "classroom_text_production") {
      console.log("\n=== TEXT PRODUCTION REPORT ===");
      let totalFragments = 0;
      let totalSurvived = 0;
      let totalTyped = 0;
      const chaosCounts = {};
      const chaosFailures = {};

      for (const row of summary) {
        const tp = row.textProduction;
        if (!tp) continue;
        totalFragments += tp.totalFragments;
        totalSurvived += tp.survivedAll;
        totalTyped += tp.typedOk;

        for (const fr of tp.fragmentResults) {
          chaosCounts[fr.chaosEvent] = (chaosCounts[fr.chaosEvent] || 0) + 1;
          if (!fr.survivedOnAll) {
            chaosFailures[fr.chaosEvent] = (chaosFailures[fr.chaosEvent] || 0) + 1;
          }
        }
      }

      console.log(`\nFragments: ${totalSurvived}/${totalFragments} survived on all pages (${totalTyped}/${totalFragments} typed successfully)`);
      const allGroupsConverged = summary.every((row) => row.textProduction?.converged);
      console.log(`Groups converged: ${summary.filter((row) => row.textProduction?.converged).length}/${summary.length}`);
      console.log("\nChaos event breakdown:");
      console.log("event | attempts | failures | failure_rate");
      for (const event of CHAOS_EVENTS) {
        const attempts = chaosCounts[event] || 0;
        const fails = chaosFailures[event] || 0;
        if (attempts > 0) {
          const rate = ((fails / attempts) * 100).toFixed(0);
          console.log(`${event} | ${attempts} | ${fails} | ${rate}%`);
        }
      }

      const allOk =
        totalSurvived === totalFragments &&
        totalTyped === totalFragments &&
        allGroupsConverged;
      printRunSummary(scenario, allOk, {
        "fragments-survived": totalSurvived === totalFragments,
        "fragments-typed": totalTyped === totalFragments,
        "groups-converged": allGroupsConverged,
      });
    }

    if (keepOpen) {
      console.log("Leave the browser open and press Ctrl+C to exit.");
      await new Promise(() => {});
    }
  } finally {
    await Promise.all(contexts.flatMap(({ extraPages = [] }) => extraPages).map(async (page) => page.close().catch(() => {})));
    await Promise.all(contexts.map(async ({ context }) => context.close().catch(() => {})));
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  console.log("");
  console.log("=".repeat(60));
  console.log(`Scenario: ${scenario}`);
  console.log(`Result: FAIL (unhandled error)`);
  console.log(`Error: ${error.message || error}`);
  console.log("=".repeat(60));
  process.exit(1);
});
