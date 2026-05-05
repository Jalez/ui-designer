/**
 * playwright-concurrent-race-smoke.mjs
 *
 * Reproduces two blind-overwrite races in game_instances.progress_data:
 *
 *   Race 1 — variant assignment
 *     Many group members navigate to the game simultaneously. Each triggers
 *     ensureVariantAssignmentsForInstance, which reads the current
 *     variantAssignments, randomly picks a variant for any unassigned level,
 *     then writes the result. Without row-level protection the last writer
 *     wins, so group members can end up with different variants applied to
 *     their browsers (one member's page uses a stale assignment).
 *
 *   Race 2 — concurrent submission
 *     Two group members submit the game at the same time. Each reads existing
 *     progress_data (without the other's userFinishState), appends their own
 *     entry, then writes. Without row-level protection the last writer wins,
 *     so one member's submission is silently lost.
 *
 * EXPECTED BEFORE FIX:  Both races are detected → FAIL
 * EXPECTED AFTER FIX:   Both races are resolved  → PASS
 *
 * Run:
 *   npm run pw:concurrent-race
 */

import { chromium } from "@playwright/test";
import { TOUR_SPOT_ACKS } from "./playwright-tour-acks.mjs";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const HEADED = process.env.PLAYWRIGHT_HEADED === "true";
const VIEWPORT = { width: 430, height: 932 };
const CONCURRENCY = Number(process.env.PLAYWRIGHT_RACE_CONCURRENCY || 20);

// ---------------------------------------------------------------------------
// Level fixture — two clearly distinct variants
// ---------------------------------------------------------------------------

const VARIANT_A_ID = "pw-race-variant-a";
const VARIANT_B_ID = "pw-race-variant-b";
const SCENARIO_ID = "scenario-pw-race";

const SHARED_VARIANT_FIELDS = {
  scenarios: [{ scenarioId: SCENARIO_ID, accuracy: 0, dimensions: { width: 200, height: 150 }, js: "" }],
  maxPoints: 100,
  help: { description: "", images: [], usefullCSSProperties: [] },
  instructions: [],
  question_and_answer: { question: "", answer: "" },
  showSolutionImageInsteadOfDiff: true,
  lockCSS: false, lockHTML: false, lockJS: false,
  interactive: false, showScenarioModel: true, showHotkeys: false,
  events: [], percentageTreshold: 70, percentageFullPointsTreshold: 95,
  pointsThresholds: [
    { accuracy: 70, pointsPercent: 25 },
    { accuracy: 85, pointsPercent: 60 },
    { accuracy: 95, pointsPercent: 100 },
  ],
  difficulty: "easy",
};

const BASE_CODE = { html: "<div class='box'></div>", css: ".box{width:80px;height:80px;background:grey}", js: "" };
const SOLUTION_A  = { html: "<div class='box'></div>", css: ".box{width:80px;height:80px;background:#dc2626}", js: "" };
const SOLUTION_B  = { html: "<div class='box'></div>", css: ".box{width:80px;height:80px;background:#2563eb}", js: "" };

function createRaceLevel() {
  return {
    name: "pw-race-template",
    scenarios: SHARED_VARIANT_FIELDS.scenarios,
    buildingBlocks: { pictures: [], colors: [] },
    code: BASE_CODE,
    solution: { html: "", css: "", js: "" },
    accuracy: 0,
    week: "playwright-race",
    percentageTreshold: 70, percentageFullPointsTreshold: 95,
    pointsThresholds: SHARED_VARIANT_FIELDS.pointsThresholds,
    difficulty: "easy", instructions: [],
    question_and_answer: { question: "", answer: "" },
    help: { description: "race smoke test", images: [], usefullCSSProperties: [] },
    timeData: { startTime: 0, pointAndTime: { 0: "0:0" } },
    events: [],
    interactive: false, showScenarioModel: true, showHotkeys: false,
    showSolutionImageInsteadOfDiff: true,
    lockCSS: false, lockHTML: false, lockJS: false,
    completed: "", points: 0, maxPoints: 100, confettiSprinkled: false,
    variants: [
      { id: VARIANT_A_ID, name: "Variant A", content: { ...SHARED_VARIANT_FIELDS, code: BASE_CODE, solution: SOLUTION_A } },
      { id: VARIANT_B_ID, name: "Variant B", content: { ...SHARED_VARIANT_FIELDS, code: BASE_CODE, solution: SOLUTION_B } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function signIn(page, username) {
  await page.goto(new URL("/auth/signin", BASE_URL).toString(), { waitUntil: "networkidle" });
  const result = await page.evaluate(async (un) => {
    const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
    const { csrfToken } = await csrfRes.json();
    const body = new URLSearchParams({ csrfToken, username: un, callbackUrl: "/", json: "true" });
    const res = await fetch("/api/auth/callback/dev-user", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      credentials: "include",
    });
    return { ok: res.ok, status: res.status };
  }, username);
  if (!result.ok) throw new Error(`Sign-in failed for ${username}: ${result.status}`);
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const authed = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session", { credentials: "include" });
      const s = await r.json();
      return Boolean(s?.user?.email);
    });
    if (authed) break;
    await page.waitForTimeout(200);
  }
  await page.evaluate(async (acks) => {
    await fetch("/api/user/tour-spots", {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acks }),
    }).catch(() => {});
  }, TOUR_SPOT_ACKS);
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function createGame(request, title) {
  const res = await request.post(`${BASE_URL}/api/games`, { data: { title, progressData: {} } });
  if (!res.ok()) throw new Error(`Create game: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function patchGame(request, gameId, data) {
  const res = await request.patch(`${BASE_URL}/api/games/${gameId}`, { data });
  if (!res.ok()) throw new Error(`Patch game: ${res.status()} ${await res.text()}`);
}

async function createLevel(request, level) {
  const res = await request.post(`${BASE_URL}/api/levels`, { data: level });
  if (!res.ok()) throw new Error(`Create level: ${res.status()} ${await res.text()}`);
  const { identifier } = await res.json();
  if (!identifier) throw new Error("No identifier returned");
  return identifier;
}

async function attachLevel(request, mapName, identifier) {
  const res = await request.post(`${BASE_URL}/api/maps/levels/${encodeURIComponent(mapName)}`, { data: { levels: [identifier] } });
  if (!res.ok()) throw new Error(`Attach level: ${res.status()} ${await res.text()}`);
}

async function createGroup(request, gameId, label) {
  const name = `pw-race-${label}-${Date.now().toString(36)}`;
  const res = await request.post(`${BASE_URL}/api/groups`, { data: { name, resourceLinkId: gameId } });
  if (!res.ok()) throw new Error(`Create group: ${res.status()} ${await res.text()}`);
  const { group: { id: groupId } } = await res.json();
  const det = await request.get(`${BASE_URL}/api/groups/${groupId}`);
  const { group: { joinKey } } = await det.json();
  return { groupId, joinKey };
}

async function joinGroup(request, groupId, joinKey) {
  const res = await request.post(`${BASE_URL}/api/groups/${groupId}/members`, { data: { joinKey } });
  if (!res.ok()) throw new Error(`Join group: ${res.status()} ${await res.text()}`);
}

async function fetchInstance(request, gameId, groupId) {
  const res = await request.get(
    `${BASE_URL}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
  );
  if (!res.ok()) throw new Error(`Fetch instance: ${res.status()} ${await res.text()}`);
  return await res.json();
}

async function submitGame(request, gameId, groupId, points = 50, maxPoints = 100) {
  const res = await request.post(
    `${BASE_URL}/api/games/${gameId}/finish?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
    { data: { points, maxPoints } },
  );
  if (!res.ok()) throw new Error(`Submit: ${res.status()} ${await res.text()}`);
  return await res.json();
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printResult(label, passed, checks) {
  console.log("");
  console.log("=".repeat(60));
  console.log(`Race: ${label}`);
  console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  for (const [name, ok] of Object.entries(checks)) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  }
  console.log("=".repeat(60));
  if (!passed) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Race 1: variant assignment
// ---------------------------------------------------------------------------

async function runVariantAssignmentRace(ownerCtx, joinerCtx) {
  console.log("\n[race1] === Variant assignment race ===");
  const title = `pw-race-variant-${Date.now().toString(36)}`;
  const { id: gameId, mapName } = await createGame(ownerCtx.request, title);
  await patchGame(ownerCtx.request, gameId, { collaborationMode: "group", isPublic: true, title });
  const levelId = await createLevel(ownerCtx.request, createRaceLevel());
  await attachLevel(ownerCtx.request, mapName, levelId);
  const { groupId, joinKey } = await createGroup(ownerCtx.request, gameId, "g1");
  await joinGroup(joinerCtx.request, groupId, joinKey);
  console.log(`[race1] game=${gameId} group=${groupId} level=${levelId}`);

  // Fire CONCURRENCY simultaneous GET /instance requests — all from the owner's
  // session on a fresh instance (no variantAssignments yet). Without locking,
  // each independently picks a random variant; last write wins in the DB but
  // different responses return different assignments.
  console.log(`[race1] firing ${CONCURRENCY} concurrent GET /instance requests...`);
  const responses = await Promise.all(
    Array.from({ length: CONCURRENCY }, () =>
      fetchInstance(ownerCtx.request, gameId, groupId),
    ),
  );

  const assignmentSets = responses.map((r) => {
    const a = r?.instance?.progressData?.variantAssignments ?? {};
    return a[levelId] ?? null;
  });

  const uniqueAssignments = [...new Set(assignmentSets.filter(Boolean))];
  console.log(`[race1] variant assignments seen across ${CONCURRENCY} responses: ${uniqueAssignments.join(", ")}`);

  // Also check what the DB actually stored after all writes settled
  const finalInstance = await fetchInstance(ownerCtx.request, gameId, groupId);
  const dbAssignment = finalInstance?.instance?.progressData?.variantAssignments?.[levelId] ?? null;
  console.log(`[race1] DB-stored assignment: ${dbAssignment}`);

  const allResponsesAgree = uniqueAssignments.length === 1;
  const allResponsesMatchDb = assignmentSets.every((a) => a === dbAssignment);

  const checks = {
    "all-responses-return-same-variant": allResponsesAgree,
    "all-responses-match-db-state": allResponsesMatchDb,
  };

  printResult("variant-assignment-race", Object.values(checks).every(Boolean), checks);
  return Object.values(checks).every(Boolean);
}

// ---------------------------------------------------------------------------
// Race 2: concurrent submission
// ---------------------------------------------------------------------------

async function runSubmissionRace(ownerCtx, joinerCtx) {
  console.log("\n[race2] === Concurrent submission race ===");
  const title = `pw-race-submit-${Date.now().toString(36)}`;
  const { id: gameId, mapName } = await createGame(ownerCtx.request, title);
  await patchGame(ownerCtx.request, gameId, { collaborationMode: "group", isPublic: true, title });
  const levelId = await createLevel(ownerCtx.request, createRaceLevel());
  await attachLevel(ownerCtx.request, mapName, levelId);
  const { groupId, joinKey } = await createGroup(ownerCtx.request, gameId, "g2");
  await joinGroup(joinerCtx.request, groupId, joinKey);

  // Warm up the instance so both users have a valid instance to submit against
  await fetchInstance(ownerCtx.request, gameId, groupId);
  console.log(`[race2] game=${gameId} group=${groupId}`);

  // Both users submit simultaneously
  console.log("[race2] firing 2 concurrent POST /finish requests...");
  const [resultA, resultB] = await Promise.all([
    submitGame(ownerCtx.request, gameId, groupId, 80, 100),
    submitGame(joinerCtx.request, gameId, groupId, 60, 100),
  ]);

  // Fetch the final instance state and check both userFinishState entries exist
  const finalInstance = await fetchInstance(ownerCtx.request, gameId, groupId);
  const userFinishStates = finalInstance?.instance?.progressData?.userFinishStates ?? {};
  const entryCount = Object.keys(userFinishStates).length;
  console.log(`[race2] userFinishStates entries after concurrent submit: ${entryCount}`);
  console.log(`[race2] keys: ${Object.keys(userFinishStates).join(", ")}`);

  const bothEntriesPresent = entryCount >= 2;
  const checks = {
    "both-submissions-persisted": bothEntriesPresent,
  };

  printResult("concurrent-submission-race", Object.values(checks).every(Boolean), checks);
  return Object.values(checks).every(Boolean);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const browser = await chromium.launch({ headless: !HEADED });
  try {
    const [ownerCtx, joinerCtx] = await Promise.all([
      browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
      browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
    ]);
    const [ownerPage, joinerPage] = await Promise.all([
      ownerCtx.newPage(),
      joinerCtx.newPage(),
    ]);

    await Promise.all([
      signIn(ownerPage, "user01"),
      signIn(joinerPage, "user02"),
    ]);
    console.log("[setup] signed in user01 (owner) and user02 (joiner)");

    const race1Passed = await runVariantAssignmentRace(ownerCtx, joinerCtx);
    const race2Passed = await runSubmissionRace(ownerCtx, joinerCtx);

    await Promise.allSettled([ownerCtx.close(), joinerCtx.close()]);

    console.log("\n" + "=".repeat(60));
    console.log("Overall result:", race1Passed && race2Passed ? "PASS" : "FAIL");
    console.log("=".repeat(60));
    if (!race1Passed || !race2Passed) process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exitCode = 1;
});
