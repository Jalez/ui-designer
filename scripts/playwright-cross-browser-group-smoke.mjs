/**
 * playwright-cross-browser-group-smoke.mjs
 *
 * Verifies that two group members on different browsers (Chromium vs Firefox)
 * each generate and use their own solution artifact, keyed by their platform
 * bucket, rather than sharing a single cached image.
 *
 * The level intentionally uses a native <input type="range"> slider, which
 * renders differently across browser engines — making cross-browser isolation
 * a correctness requirement, not just a nice-to-have.
 *
 * Checks:
 *   1. The two browsers produce different platform bucket strings.
 *   2. Each browser's artifact requests carry only its own bucket.
 *   3. Both browsers eventually receive a solution artifact (no infinite miss).
 *
 * Run:
 *   npm run pw:cross-browser-group
 *
 * Requires Firefox to be installed:
 *   npm run pw:install-browsers
 */

import { chromium, firefox } from "@playwright/test";
import { TOUR_SPOT_ACKS } from "./playwright-tour-acks.mjs";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const HEADED = process.env.PLAYWRIGHT_HEADED === "true";
const TIMEOUT_MS = Number(process.env.PLAYWRIGHT_CROSS_BROWSER_TIMEOUT_MS || 60_000);
const VIEWPORT = { width: 430, height: 932 };

const SCENARIO_ID = "scenario-pw-cross-browser";

/** Level with a native slider — a classic cross-browser rendering difference. */
function createCrossBrowserLevel() {
  return {
    name: "pw-cross-browser-template",
    scenarios: [
      {
        scenarioId: SCENARIO_ID,
        accuracy: 0,
        dimensions: { width: 320, height: 200 },
        js: "",
      },
    ],
    buildingBlocks: { pictures: [], colors: [] },
    code: {
      html: `<main class="shell">
  <label for="vol">Volume</label>
  <input id="vol" type="range" min="0" max="100" value="50" />
  <output id="out">50</output>
</main>`,
      css: `body { margin: 0; display: grid; place-items: center; min-height: 100%; background: #f8fafc; font-family: sans-serif; }
.shell { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 24px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
input[type=range] { width: 200px; }
output { font-size: 1.4rem; font-weight: 700; color: #0f172a; }`,
      js: `document.getElementById('vol').addEventListener('input', (e) => {
  document.getElementById('out').value = e.target.value;
});`,
    },
    solution: {
      html: `<main class="shell">
  <label for="vol">Volume</label>
  <input id="vol" type="range" min="0" max="100" value="75" />
  <output id="out">75</output>
</main>`,
      css: `body { margin: 0; display: grid; place-items: center; min-height: 100%; background: #f8fafc; font-family: sans-serif; }
.shell { display: flex; flex-direction: column; gap: 12px; align-items: center; padding: 24px; background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
input[type=range] { width: 200px; }
output { font-size: 1.4rem; font-weight: 700; color: #0f172a; }`,
      js: "",
    },
    accuracy: 0,
    week: "playwright-cross-browser",
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
    help: { description: "Cross-browser rendering smoke test", images: [], usefullCSSProperties: [] },
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

  // Wait for session to be established
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

  // Pre-acknowledge all tour spots so the Joyride overlay never blocks clicks.
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

async function createGroupGame(request, username) {
  const title = `Playwright cross-browser ${new Date().toISOString()}`;

  const gameRes = await request.post(`${BASE_URL}/api/games`, {
    data: { title, progressData: {} },
  });
  if (!gameRes.ok()) {
    throw new Error(`Create game failed: ${gameRes.status()} ${await gameRes.text()}`);
  }
  const { id: gameId, mapName } = await gameRes.json();

  const patchRes = await request.patch(`${BASE_URL}/api/games/${gameId}`, {
    data: { collaborationMode: "group", isPublic: true, title },
  });
  if (!patchRes.ok()) {
    throw new Error(`Patch game failed: ${patchRes.status()} ${await patchRes.text()}`);
  }

  // Create level with a scenario so drawboards render and make artifact requests
  const level = createCrossBrowserLevel();
  const levelRes = await request.post(`${BASE_URL}/api/levels`, { data: level });
  if (!levelRes.ok()) {
    throw new Error(`Create level failed: ${levelRes.status()} ${await levelRes.text()}`);
  }
  const { identifier } = await levelRes.json();
  if (!identifier) throw new Error("Level create response missing identifier");

  const mapRes = await request.post(
    `${BASE_URL}/api/maps/levels/${encodeURIComponent(mapName)}`,
    { data: { levels: [identifier] } },
  );
  if (!mapRes.ok()) {
    throw new Error(`Attach level failed: ${mapRes.status()} ${await mapRes.text()}`);
  }

  // Create group
  const groupName = `pw-cross-browser-${Date.now().toString(36)}`;
  const groupRes = await request.post(`${BASE_URL}/api/groups`, {
    data: { name: groupName, resourceLinkId: gameId },
  });
  if (!groupRes.ok()) {
    throw new Error(`Create group failed: ${groupRes.status()} ${await groupRes.text()}`);
  }
  const { group: { id: groupId } } = await groupRes.json();

  const detailsRes = await request.get(`${BASE_URL}/api/groups/${groupId}`);
  if (!detailsRes.ok()) {
    throw new Error(`Fetch group failed: ${detailsRes.status()} ${await detailsRes.text()}`);
  }
  const { group: { joinKey } } = await detailsRes.json();

  // Seed instance with the level
  const seedRes = await request.patch(
    `${BASE_URL}/api/games/${gameId}/instance?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
    { data: { progressData: { levels: [createCrossBrowserLevel()] } } },
  );
  if (!seedRes.ok()) {
    throw new Error(`Seed instance failed: ${seedRes.status()} ${await seedRes.text()}`);
  }

  console.log(`[setup] created game=${gameId} group=${groupId} joinKey=${joinKey}`);
  return { gameId, groupId, joinKey, groupName };
}

async function joinGroup(request, groupId, joinKey, username) {
  const res = await request.post(`${BASE_URL}/api/groups/${groupId}/members`, {
    data: { joinKey },
  });
  if (!res.ok()) {
    throw new Error(`Join group failed for ${username}: ${res.status()} ${await res.text()}`);
  }
  console.log(`[setup] ${username} joined group ${groupId}`);
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

async function startGame(pages) {
  for (const page of pages) {
    const waitingRoom = page.getByText("Group Waiting Room");
    await Promise.race([
      waitingRoom.first().waitFor({ timeout: 15_000 }).catch(() => null),
      page.locator(".cm-content").first().waitFor({ timeout: 15_000 }).catch(() => null),
    ]);

    if ((await waitingRoom.count()) > 0) {
      const startButton = page.getByRole("button", { name: "Start Game" });
      const deadline = Date.now() + 25_000;
      while (Date.now() < deadline) {
        const editorVisible = await page.locator(".cm-content").first().isVisible().catch(() => false);
        if (editorVisible) break;
        const startVisible = await startButton.isVisible().catch(() => false);
        const startEnabled = startVisible && await startButton.isEnabled().catch(() => false);
        if (startEnabled) {
          await startButton.click();
        }
        await page.waitForTimeout(500);
      }
    }
  }
}

async function waitForEditor(page, label) {
  await page.locator(".cm-content").first().waitFor({ timeout: TIMEOUT_MS });
  console.log(`[editor] ready on ${label}`);
}

// ---------------------------------------------------------------------------
// Artifact request capture
// ---------------------------------------------------------------------------

/**
 * Attaches a request listener to the page and returns a collector object.
 * Collects platform buckets seen in GET /api/drawboard/artifacts requests
 * with artifactType=solution.
 */
function attachArtifactCollector(page, label) {
  const bucketsSeen = new Set();
  const allArtifactRequests = [];

  page.on("request", (req) => {
    const url = req.url();
    if (!url.includes("/api/drawboard/artifacts")) return;
    if (req.method() !== "GET") return;

    const parsed = new URL(url);
    const artifactType = parsed.searchParams.get("artifactType");
    const platformBucket = parsed.searchParams.get("platformBucket");

    allArtifactRequests.push({ artifactType, platformBucket, url });

    if (artifactType === "solution" && platformBucket) {
      bucketsSeen.add(platformBucket);
      console.log(`[artifact] ${label} solution request bucket=${platformBucket}`);
    }
  });

  return { bucketsSeen, allArtifactRequests };
}

/**
 * Waits until at least one solution artifact request has been observed,
 * or the timeout elapses.
 */
async function waitForSolutionRequest(page, collector, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (collector.bucketsSeen.size > 0) return true;
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
  console.log("Scenario: cross_browser_group");
  console.log(`Result: ${passed ? "PASS" : "FAIL"}`);
  for (const [name, ok] of Object.entries(checks)) {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  }
  console.log("=".repeat(60));
  if (!passed) {
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  let chromiumBrowser = null;
  let firefoxBrowser = null;
  let chromiumContext = null;
  let firefoxContext = null;

  try {
    [chromiumBrowser, firefoxBrowser] = await Promise.all([
      chromium.launch({ headless: !HEADED }),
      firefox.launch({ headless: !HEADED }),
    ]);

    [chromiumContext, firefoxContext] = await Promise.all([
      chromiumBrowser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
      firefoxBrowser.newContext({ baseURL: BASE_URL, viewport: VIEWPORT }),
    ]);

    const chromiumPage = await chromiumContext.newPage();
    const firefoxPage = await firefoxContext.newPage();

    // Sign in both users in parallel
    await Promise.all([
      signIn(chromiumPage, "user01"),
      signIn(firefoxPage, "user02"),
    ]);

    // Chromium user creates the game; Firefox user joins
    const { gameId, groupId, joinKey } = await createGroupGame(
      chromiumContext.request,
      "user01",
    );
    await joinGroup(firefoxContext.request, groupId, joinKey, "user02");

    // Attach artifact collectors BEFORE navigating so we don't miss early requests
    const chromiumCollector = attachArtifactCollector(chromiumPage, "chromium");
    const firefoxCollector = attachArtifactCollector(firefoxPage, "firefox");

    const url = gameUrl(gameId, groupId);
    await Promise.all([
      navigateTo(chromiumPage, url, "chromium"),
      navigateTo(firefoxPage, url, "firefox"),
    ]);

    await startGame([chromiumPage, firefoxPage]);

    await Promise.all([
      waitForEditor(chromiumPage, "chromium"),
      waitForEditor(firefoxPage, "firefox"),
    ]);

    console.log("[test] editors ready on both browsers — waiting for solution artifact requests...");

    // Wait for each browser to make at least one solution artifact request
    const [chromiumGotRequest, firefoxGotRequest] = await Promise.all([
      waitForSolutionRequest(chromiumPage, chromiumCollector, "chromium", TIMEOUT_MS),
      waitForSolutionRequest(firefoxPage, firefoxCollector, "firefox", TIMEOUT_MS),
    ]);

    // Read the platform buckets from the page to double-check
    const [chromiumBucketFromPage, firefoxBucketFromPage] = await Promise.all([
      chromiumPage.evaluate(() => {
        const ua = navigator.userAgent;
        const browser = /Chrome\//i.test(ua) && !/Edg\//i.test(ua)
          ? `chrome-${(ua.match(/Chrome\/([\d]+)/) || [])[1] || "?"}`
          : /Firefox\/([\d]+)/i.test(ua)
          ? `firefox-${(ua.match(/Firefox\/([\d]+)/) || [])[1] || "?"}`
          : "browser-unknown";
        const os = /Mac OS X ([\d_]+)/i.test(ua)
          ? `macos-${(ua.match(/Mac OS X ([\d_]+)/i) || [])[1] || "?"}`
          : /Linux/i.test(ua) ? "linux" : "os-unknown";
        return `${browser}__${os}`;
      }),
      firefoxPage.evaluate(() => {
        const ua = navigator.userAgent;
        const browser = /Firefox\/([\d]+)/i.test(ua)
          ? `firefox-${(ua.match(/Firefox\/([\d]+)/) || [])[1] || "?"}`
          : /Chrome\//i.test(ua) && !/Edg\//i.test(ua)
          ? `chrome-${(ua.match(/Chrome\/([\d]+)/) || [])[1] || "?"}`
          : "browser-unknown";
        const os = /Mac OS X ([\d_]+)/i.test(ua)
          ? `macos-${(ua.match(/Mac OS X ([\d_]+)/i) || [])[1] || "?"}`
          : /Linux/i.test(ua) ? "linux" : "os-unknown";
        return `${browser}__${os}`;
      }),
    ]);

    console.log(`[buckets] chromium page bucket: ${chromiumBucketFromPage}`);
    console.log(`[buckets] firefox  page bucket: ${firefoxBucketFromPage}`);

    const chromiumBucketFromRequest = [...chromiumCollector.bucketsSeen][0] ?? null;
    const firefoxBucketFromRequest = [...firefoxCollector.bucketsSeen][0] ?? null;
    console.log(`[buckets] chromium request bucket: ${chromiumBucketFromRequest}`);
    console.log(`[buckets] firefox  request bucket: ${firefoxBucketFromRequest}`);

    // Verify no cross-contamination: each browser should never request the other's bucket
    const chromiumRequestedFirefoxBucket = firefoxBucketFromRequest
      ? chromiumCollector.allArtifactRequests.some(
          (r) => r.platformBucket === firefoxBucketFromRequest,
        )
      : false;
    const firefoxRequestedChromiumBucket = chromiumBucketFromRequest
      ? firefoxCollector.allArtifactRequests.some(
          (r) => r.platformBucket === chromiumBucketFromRequest,
        )
      : false;

    const bucketsAreDifferent =
      chromiumBucketFromRequest !== null &&
      firefoxBucketFromRequest !== null &&
      chromiumBucketFromRequest !== firefoxBucketFromRequest;

    const chromiumBucketIsChrome =
      chromiumBucketFromRequest?.startsWith("chrome-") ?? false;
    const firefoxBucketIsFirefox =
      firefoxBucketFromRequest?.startsWith("firefox-") ?? false;

    const checks = {
      "chromium-got-solution-request": chromiumGotRequest,
      "firefox-got-solution-request": firefoxGotRequest,
      "buckets-are-different": bucketsAreDifferent,
      "chromium-bucket-is-chrome": chromiumBucketIsChrome,
      "firefox-bucket-is-firefox": firefoxBucketIsFirefox,
      "no-cross-contamination-chromium": !chromiumRequestedFirefoxBucket,
      "no-cross-contamination-firefox": !firefoxRequestedChromiumBucket,
    };

    const passed = Object.values(checks).every(Boolean);
    printResult(passed, checks);

  } finally {
    await Promise.allSettled([
      chromiumContext?.close(),
      firefoxContext?.close(),
    ]);
    await Promise.allSettled([
      chromiumBrowser?.close(),
      firefoxBrowser?.close(),
    ]);
  }
}

main().catch((error) => {
  console.error("[fatal]", error);
  process.exitCode = 1;
});
