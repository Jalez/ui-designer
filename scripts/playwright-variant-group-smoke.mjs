/**
 * playwright-variant-group-smoke.mjs
 *
 * Verifies that two groups playing the same game, but with different level
 * variants assigned, hydrate the intended group-specific variant and do not
 * cross-request cached artifacts when the drawboard artifact cache is active.
 *
 * Both groups use the same browser (Chromium), so the platform bucket is
 * identical. The only differentiator is the variant — different solution
 * HTML/CSS → different artifact fingerprint → different Redis cache key.
 *
 * If this isolation broke, group B could receive group A's solution image
 * and score against the wrong target.
 *
 * Checks:
 *   1. Each group instance has the intended variant assignment.
 *   2. If solution artifact requests are made, neither group requests the
 *      other group's fingerprint.
 *
 * Run:
 *   npm run pw:variant-group
 */

import { chromium } from "@playwright/test";
import { TOUR_SPOT_ACKS } from "./playwright-tour-acks.mjs";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const HEADED = process.env.PLAYWRIGHT_HEADED === "true";
const TIMEOUT_MS = Number(process.env.PLAYWRIGHT_VARIANT_TIMEOUT_MS || 60_000);
const VIEWPORT = { width: 430, height: 932 };

const SCENARIO_ID = "scenario-pw-variant-group";

// Two variants with visually distinct solutions — variant-a is red, variant-b is blue.
// Different hex colour in the solution HTML → different fingerprint.
const VARIANT_A_ID = "pw-variant-a";
const VARIANT_B_ID = "pw-variant-b";

const BASE_LEVEL_CODE = {
  html: `<main class="shell">
  <div class="box"></div>
  <p class="label">Match the box colour</p>
</main>`,
  css: `body { margin: 0; display: grid; place-items: center; min-height: 100%; background: #f8fafc; font-family: sans-serif; }
.shell { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px; }
.box { width: 120px; height: 120px; background: grey; border-radius: 12px; }
.label { margin: 0; font-size: 0.875rem; color: #64748b; }`,
  js: "",
};

const BASE_SCENARIO = {
  scenarioId: SCENARIO_ID,
  accuracy: 0,
  dimensions: { width: 320, height: 240 },
  js: "",
};

const VARIANT_SHARED = {
  scenarios: [BASE_SCENARIO],
  maxPoints: 100,
  help: { description: "Variant smoke test", images: [], usefullCSSProperties: [] },
  instructions: [],
  question_and_answer: { question: "", answer: "" },
  showSolutionImageInsteadOfDiff: true,
  lockCSS: false,
  lockHTML: false,
  lockJS: false,
  interactive: false,
  showScenarioModel: true,
  showHotkeys: false,
  events: [],
  percentageTreshold: 70,
  percentageFullPointsTreshold: 95,
  pointsThresholds: [
    { accuracy: 70, pointsPercent: 25 },
    { accuracy: 85, pointsPercent: 60 },
    { accuracy: 95, pointsPercent: 100 },
  ],
  difficulty: "easy",
};

// Variant A solution: red box (#dc2626)
const VARIANT_A_SOLUTION = {
  html: `<main class="shell">
  <div class="box"></div>
  <p class="label">Match the box colour</p>
</main>`,
  css: `body { margin: 0; display: grid; place-items: center; min-height: 100%; background: #f8fafc; font-family: sans-serif; }
.shell { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px; }
.box { width: 120px; height: 120px; background: #dc2626; border-radius: 12px; }
.label { margin: 0; font-size: 0.875rem; color: #64748b; }`,
  js: "",
};

// Variant B solution: blue box (#2563eb)
const VARIANT_B_SOLUTION = {
  html: `<main class="shell">
  <div class="box"></div>
  <p class="label">Match the box colour</p>
</main>`,
  css: `body { margin: 0; display: grid; place-items: center; min-height: 100%; background: #f8fafc; font-family: sans-serif; }
.shell { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 32px; }
.box { width: 120px; height: 120px; background: #2563eb; border-radius: 12px; }
.label { margin: 0; font-size: 0.875rem; color: #64748b; }`,
  js: "",
};

function createVariantLevel() {
  return {
    name: "pw-variant-group-template",
    scenarios: [BASE_SCENARIO],
    buildingBlocks: { pictures: [], colors: [] },
    code: BASE_LEVEL_CODE,
    solution: { html: "", css: "", js: "" }, // base has no solution — variants supply it
    accuracy: 0,
    week: "playwright-variant",
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
    help: { description: "Variant isolation smoke test", images: [], usefullCSSProperties: [] },
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
    // Two variants with different solution colours
    variants: [
      {
        id: VARIANT_A_ID,
        name: "Variant A (red)",
        content: {
          ...VARIANT_SHARED,
          code: BASE_LEVEL_CODE,
          solution: VARIANT_A_SOLUTION,
        },
      },
      {
        id: VARIANT_B_ID,
        name: "Variant B (blue)",
        content: {
          ...VARIANT_SHARED,
          code: BASE_LEVEL_CODE,
          solution: VARIANT_B_SOLUTION,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async function signIn(page, username) {
  await page.goto(new URL("/auth/signin", BASE_URL).toString(), { waitUntil: "networkidle" });

  const result = await page.evaluate(async (un) => {
    const csrfRes = await fetch("/api/auth/csrf", { credentials: "include" });
    const { csrfToken } = await csrfRes.json();
    const body = new URLSearchParams({
      csrfToken,
      username: un,
      callbackUrl: "/",
      json: "true",
    });
    const res = await fetch("/api/auth/callback/dev-user", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      credentials: "include",
    });
    return { ok: res.ok, status: res.status };
  }, username);

  if (!result.ok) {
    throw new Error(`Sign-in failed for ${username}: HTTP ${result.status}`);
  }

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const authed = await page.evaluate(async () => {
      const r = await fetch("/api/auth/session", { credentials: "include" });
      const s = await r.json();
      return Boolean(s?.user?.email);
    });
    if (authed) break;
    await page.waitForTimeout(300);
  }

  await page.evaluate(async (acks) => {
    await fetch("/api/user/tour-spots", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acks }),
    }).catch(() => {});
  }, TOUR_SPOT_ACKS);

  console.log(`[auth] signed in ${username}`);
}

// ---------------------------------------------------------------------------
// Game / group provisioning
// ---------------------------------------------------------------------------

async function createVariantGame(request) {
  const title = `Playwright variant-group ${new Date().toISOString()}`;

  const gameRes = await request.post(`${BASE_URL}/api/games`, {
    data: { title, progressData: {} },
  });
  if (!gameRes.ok()) throw new Error(`Create game failed: ${gameRes.status()} ${await gameRes.text()}`);
  const { id: gameId, mapName } = await gameRes.json();

  const patchRes = await request.patch(`${BASE_URL}/api/games/${gameId}`, {
    data: { collaborationMode: "group", isPublic: true, title },
  });
  if (!patchRes.ok()) throw new Error(`Patch game failed: ${patchRes.status()} ${await patchRes.text()}`);

  // Create level with two variants
  const levelRes = await request.post(`${BASE_URL}/api/levels`, { data: createVariantLevel() });
  if (!levelRes.ok()) throw new Error(`Create level failed: ${levelRes.status()} ${await levelRes.text()}`);
  const { identifier: levelIdentifier } = await levelRes.json();
  if (!levelIdentifier) throw new Error("Level create response missing identifier");

  const mapRes = await request.post(
    `${BASE_URL}/api/maps/levels/${encodeURIComponent(mapName)}`,
    { data: { levels: [levelIdentifier] } },
  );
  if (!mapRes.ok()) throw new Error(`Attach level failed: ${mapRes.status()} ${await mapRes.text()}`);

  console.log(`[setup] created game=${gameId} level=${levelIdentifier}`);
  return { gameId, mapName, levelIdentifier };
}

async function createGroup(request, gameId, label) {
  const groupName = `pw-variant-${label}-${Date.now().toString(36)}`;
  const groupRes = await request.post(`${BASE_URL}/api/groups`, {
    data: { name: groupName, resourceLinkId: gameId },
  });
  if (!groupRes.ok()) throw new Error(`Create group ${label} failed: ${groupRes.status()} ${await groupRes.text()}`);
  const { group: { id: groupId } } = await groupRes.json();

  const detailsRes = await request.get(`${BASE_URL}/api/groups/${groupId}`);
  if (!detailsRes.ok()) throw new Error(`Fetch group ${label} failed: ${detailsRes.status()} ${await detailsRes.text()}`);
  const { group: { joinKey } } = await detailsRes.json();

  return { groupId, groupName, joinKey };
}

async function seedInstanceWithVariant(request, gameId, groupId, levelIdentifier, variantId) {
  const res = await request.patch(
    `${BASE_URL}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
    {
      data: {
        progressData: {
          // variantAssignments is keyed by levelIdentifier when the level has one
          variantAssignments: { [levelIdentifier]: variantId },
        },
      },
    },
  );
  if (!res.ok()) throw new Error(`Seed instance failed: ${res.status()} ${await res.text()}`);
  console.log(`[setup] seeded group=${groupId} variant=${variantId}`);
}

// ---------------------------------------------------------------------------
// Navigation + game start
// ---------------------------------------------------------------------------

function gameUrl(gameId, groupId) {
  const url = new URL(`/game/${gameId}`, BASE_URL);
  url.searchParams.set("mode", "game");
  url.searchParams.set("groupId", groupId);
  return url.toString();
}

async function navigateTo(page, url, label) {
  console.log(`[nav] ${label} → ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

/**
 * Starts a group game by polling all pages in the group until the editor
 * appears. Mirrors the logic in playwright-local-group-smoke.mjs so that
 * all members are considered when deciding whether to click Start Game.
 */
async function startGame(pages, label) {
  // Give all pages a chance to reach the waiting room or editor first
  await Promise.all(
    pages.map((page) =>
      Promise.race([
        page.getByText("Group Waiting Room").first().waitFor({ timeout: 15_000 }).catch(() => null),
        page.locator(".cm-content").first().waitFor({ timeout: 15_000 }).catch(() => null),
      ]),
    ),
  );

  // Now poll all pages until every editor is visible
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const allReady = await Promise.all(
      pages.map((page) => page.locator(".cm-content").first().isVisible().catch(() => false)),
    );
    if (allReady.every(Boolean)) break;

    // Try to click Start Game on any page that still shows the waiting room
    for (const page of pages) {
      const editorVisible = await page.locator(".cm-content").first().isVisible().catch(() => false);
      if (editorVisible) continue;
      const startButton = page.getByRole("button", { name: "Start Game" });
      const startEnabled =
        (await startButton.isVisible().catch(() => false)) &&
        (await startButton.isEnabled().catch(() => false));
      if (startEnabled) {
        await startButton.click();
      }
    }
    await pages[0].waitForTimeout(500);
  }

  // Final wait on all pages
  await Promise.all(
    pages.map((page) => page.locator(".cm-content").first().waitFor({ timeout: TIMEOUT_MS })),
  );
  console.log(`[editor] ready on ${label}`);
}

// ---------------------------------------------------------------------------
// Artifact request capture
// ---------------------------------------------------------------------------

/**
 * Attaches a request listener that collects fingerprints seen in
 * GET /api/drawboard/artifacts requests with artifactType=solution.
 */
function attachArtifactCollector(page, label) {
  const fingerprintsSeen = new Set();
  const allSolutionRequests = [];

  page.on("request", (req) => {
    if (!req.url().includes("/api/drawboard/artifacts")) return;
    if (req.method() !== "GET") return;

    const parsed = new URL(req.url());
    const artifactType = parsed.searchParams.get("artifactType");
    const fingerprint = parsed.searchParams.get("fingerprint");

    if (artifactType === "solution" && fingerprint) {
      fingerprintsSeen.add(fingerprint);
      allSolutionRequests.push({ fingerprint, url: req.url() });
      console.log(`[artifact] ${label} solution fingerprint=${fingerprint.slice(0, 12)}…`);
    }
  });

  return { fingerprintsSeen, allSolutionRequests };
}

/**
 * Fetches the live instance for a group and returns the variantAssignments
 * map from progressData, so we can confirm the server applied the right variant.
 */
async function fetchVariantAssignments(request, gameId, groupId) {
  const res = await request.get(
    `${BASE_URL}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
  );
  if (!res.ok()) throw new Error(`Fetch instance failed: ${res.status()} ${await res.text()}`);
  const payload = await res.json();
  const assignments = payload?.instance?.progressData?.variantAssignments ?? {};
  return assignments;
}

async function waitForSolutionRequest(page, collector, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (collector.fingerprintsSeen.size > 0) return true;
    await page.waitForTimeout(500);
  }
  console.warn(`[artifact] ${label} timed out waiting for solution artifact request`);
  return false;
}

// ---------------------------------------------------------------------------
// Result reporting
// ---------------------------------------------------------------------------

function printResult(passed, checks) {
  console.log("");
  console.log("=".repeat(60));
  console.log("Scenario: variant_group");
  console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  for (const [name, ok] of Object.entries(checks)) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  }
  console.log("=".repeat(60));
  if (!passed) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function joinGroup(request, groupId, joinKey, username) {
  const res = await request.post(`${BASE_URL}/api/groups/${groupId}/members`, {
    data: { joinKey },
  });
  if (!res.ok()) throw new Error(`Join group failed for ${username}: ${res.status()} ${await res.text()}`);
  console.log(`[setup] ${username} joined group ${groupId}`);
}

async function main() {
  const browser = await chromium.launch({ headless: !HEADED });

  try {
    // Four independent contexts on the same Chromium (same platform bucket).
    // user01+user03 in group-a (variant A), user02+user04 in group-b (variant B).
    // Two users per group so the "Start Game" button becomes enabled in the waiting room.
    const [ctxA1, ctxA2, ctxB1, ctxB2] = await Promise.all([
      browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
      browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
      browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
      browser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
    ]);

    const [pageA1, pageA2, pageB1, pageB2] = await Promise.all([
      ctxA1.newPage(), ctxA2.newPage(), ctxB1.newPage(), ctxB2.newPage(),
    ]);

    // Sign in all four users in parallel
    await Promise.all([
      signIn(pageA1, "user01"),
      signIn(pageA2, "user03"),
      signIn(pageB1, "user02"),
      signIn(pageB2, "user04"),
    ]);

    // User01 creates the game with the variant level
    const { gameId, levelIdentifier } = await createVariantGame(ctxA1.request);

    // Create two groups
    const [groupA, groupB] = await Promise.all([
      createGroup(ctxA1.request, gameId, "group-a"),
      createGroup(ctxB1.request, gameId, "group-b"),
    ]);
    console.log(`[setup] group-a=${groupA.groupId} group-b=${groupB.groupId}`);

    // Second members join their respective groups
    await Promise.all([
      joinGroup(ctxA2.request, groupA.groupId, groupA.joinKey, "user03"),
      joinGroup(ctxB2.request, groupB.groupId, groupB.joinKey, "user04"),
    ]);

    // Seed each group instance with a different variant BEFORE the game loads
    await Promise.all([
      seedInstanceWithVariant(ctxA1.request, gameId, groupA.groupId, levelIdentifier, VARIANT_A_ID),
      seedInstanceWithVariant(ctxB1.request, gameId, groupB.groupId, levelIdentifier, VARIANT_B_ID),
    ]);

    // Attach collectors on the primary pages BEFORE navigating
    const collectorA = attachArtifactCollector(pageA1, "group-a");
    const collectorB = attachArtifactCollector(pageB1, "group-b");

    // Navigate all four players to their respective game URLs
    const urlA = gameUrl(gameId, groupA.groupId);
    const urlB = gameUrl(gameId, groupB.groupId);
    await Promise.all([
      navigateTo(pageA1, urlA, "group-a/user01"),
      navigateTo(pageA2, urlA, "group-a/user03"),
      navigateTo(pageB1, urlB, "group-b/user02"),
      navigateTo(pageB2, urlB, "group-b/user04"),
    ]);

    // Start both games — pass all pages per group so the polling loop can
    // click Start Game once all members are in the waiting room.
    await Promise.all([
      startGame([pageA1, pageA2], "group-a"),
      startGame([pageB1, pageB2], "group-b"),
    ]);

    console.log("[test] editors ready — waiting for solution artifact requests...");

    await Promise.all([
      waitForSolutionRequest(pageA1, collectorA, "group-a", TIMEOUT_MS),
      waitForSolutionRequest(pageB1, collectorB, "group-b", TIMEOUT_MS),
    ]);

    const fingerprintA = [...collectorA.fingerprintsSeen][0] ?? null;
    const fingerprintB = [...collectorB.fingerprintsSeen][0] ?? null;

    console.log(`[fingerprints] group-a (variant-a): ${fingerprintA}`);
    console.log(`[fingerprints] group-b (variant-b): ${fingerprintB}`);

    // Confirm the server actually applied the intended variant to each instance
    const [assignmentsA, assignmentsB] = await Promise.all([
      fetchVariantAssignments(ctxA1.request, gameId, groupA.groupId),
      fetchVariantAssignments(ctxB1.request, gameId, groupB.groupId),
    ]);
    const appliedVariantA = assignmentsA[levelIdentifier] ?? null;
    const appliedVariantB = assignmentsB[levelIdentifier] ?? null;
    console.log(`[variants] group-a applied: ${appliedVariantA} (expected: ${VARIANT_A_ID})`);
    console.log(`[variants] group-b applied: ${appliedVariantB} (expected: ${VARIANT_B_ID})`);

    const bothFingerprintsObserved = fingerprintA !== null && fingerprintB !== null;
    const fingerprintsAreDifferent = bothFingerprintsObserved
      ? fingerprintA !== fingerprintB
      : true;

    // Cross-contamination: neither group should request the other's fingerprint
    const aRequestedBFingerprint = fingerprintB
      ? collectorA.allSolutionRequests.some((r) => r.fingerprint === fingerprintB)
      : false;
    const bRequestedAFingerprint = fingerprintA
      ? collectorB.allSolutionRequests.some((r) => r.fingerprint === fingerprintA)
      : false;

    const checks = {
      "group-a-applied-correct-variant": appliedVariantA === VARIANT_A_ID,
      "group-b-applied-correct-variant": appliedVariantB === VARIANT_B_ID,
      "fingerprints-are-different": fingerprintsAreDifferent,
      "no-cross-contamination-group-a": !aRequestedBFingerprint,
      "no-cross-contamination-group-b": !bRequestedAFingerprint,
    };

    printResult(Object.values(checks).every(Boolean), checks);

    await Promise.allSettled([ctxA1.close(), ctxA2.close(), ctxB1.close(), ctxB2.close()]);
  } finally {
    await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error("[fatal]", error);
  process.exitCode = 1;
});
