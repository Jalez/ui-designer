import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { chromium, expect } from "@playwright/test";
import { TOUR_SPOT_ACKS } from "./playwright-tour-acks.mjs";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const DEV_USERNAME_CREATOR = process.env.PLAYWRIGHT_DEV_USERNAME || "interaction-smoke-creator";
const DEV_USERNAME_MEMBER = process.env.PLAYWRIGHT_DEV_USERNAME_MEMBER || "interaction-smoke-member";
const TIMEOUT_MS = Number(process.env.PLAYWRIGHT_INTERACTION_TIMEOUT_MS || 90000);

const SCENARIO_ID = "scenario-playwright-interaction";
const TARGET_NAME = "Shared target";
const LEVEL_NAME = "Playwright Interaction Template";

const HTML_CODE = `<main class="demo-shell">
  <button id="toggle" type="button">Toggle details</button>
  <label for="name-input">Name</label>
  <input id="name-input" type="text" placeholder="Type a name" />
  <p id="status" data-open="false">Closed</p>
  <p id="mirror">Anonymous</p>
</main>`;

const CSS_CODE = `html, body {
  margin: 0;
  min-height: 100%;
  background: #eef2ff;
}

body {
  display: grid;
  place-items: center;
  font-family: Arial, sans-serif;
  transition: background 0.2s ease;
}

.demo-shell {
  width: 240px;
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: white;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

#toggle {
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  color: white;
  background: #2563eb;
  cursor: pointer;
}

#status[data-open="true"] {
  color: #166534;
  font-weight: 700;
}

#mirror {
  margin: 0;
  color: #7c2d12;
  font-weight: 600;
}`;

const JS_CODE = `const button = document.getElementById("toggle");
const status = document.getElementById("status");
const input = document.getElementById("name-input");
const mirror = document.getElementById("mirror");

button?.addEventListener("click", () => {
  if (!status) return;
  const nextOpen = status.dataset.open !== "true";
  status.dataset.open = nextOpen ? "true" : "false";
  status.textContent = nextOpen ? "Open" : "Closed";
  document.body.style.background = nextOpen ? "#fef3c7" : "#eef2ff";
});

input?.addEventListener("input", () => {
  if (!mirror || !input) return;
  mirror.textContent = input.value.trim() || "Anonymous";
});`;

function creatorStarterLevel() {
  return {
    name: LEVEL_NAME,
    scenarios: [
      {
        scenarioId: SCENARIO_ID,
        accuracy: 0,
        dimensions: { width: 320, height: 260 },
        js: "",
      },
    ],
    buildingBlocks: { pictures: [], colors: [] },
    code: { html: HTML_CODE, css: CSS_CODE, js: JS_CODE },
    solution: {
      html: `<main class="demo-shell">
  <button id="toggle" type="button">Toggle details</button>
  <label for="name-input">Name</label>
  <input id="name-input" type="text" placeholder="Type a name" value="${TARGET_NAME}" />
  <p id="status" data-open="true">Open</p>
  <p id="mirror">${TARGET_NAME}</p>
</main>`,
      css: `html, body {
  margin: 0;
  min-height: 100%;
  background: #fef3c7;
}

body {
  display: grid;
  place-items: center;
  font-family: Arial, sans-serif;
  transition: background 0.2s ease;
}

.demo-shell {
  width: 240px;
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 18px;
  background: white;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
}

#toggle {
  border: 0;
  border-radius: 999px;
  padding: 10px 14px;
  color: white;
  background: #2563eb;
  cursor: pointer;
}

#status[data-open="true"] {
  color: #166534;
  font-weight: 700;
}

#mirror {
  margin: 0;
  color: #7c2d12;
  font-weight: 600;
}`,
      js: "",
    },
    accuracy: 0,
    week: "playwright-interaction",
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
    help: { description: "Interaction smoke test", images: [], usefullCSSProperties: [] },
    timeData: { startTime: 0, pointAndTime: { 0: "0:0" } },
    eventSequence: { byScenarioId: {} },
    events: [],
    interactionArtifacts: { byScenarioId: {} },
    interactive: true,
    showScenarioModel: true,
    showHotkeys: false,
    showModelPicture: true,
    lockCSS: false,
    lockHTML: false,
    lockJS: false,
    completed: "",
    points: 0,
    maxPoints: 100,
    confettiSprinkled: false,
  };
}

async function signInDevUser(page, username) {
  await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: "networkidle" });
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
  }, username.trim().toLowerCase());

  if (!signInResult.ok) {
    throw new Error(`Local dev sign-in failed: ${signInResult.status} ${signInResult.text}`);
  }

  await expect.poll(async () => {
    return page.evaluate(async () => {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      const session = await response.json();
      return Boolean(session?.user?.email);
    });
  }, {
    timeout: TIMEOUT_MS,
    message: "Expected local dev sign-in session to become authenticated",
  }).toBe(true);
}

async function createGameWithLevel(request) {
  const gameResponse = await request.post(`${BASE_URL}/api/games`, {
    data: { title: `Playwright Interaction Smoke ${Date.now()}` },
  });
  if (!gameResponse.ok()) {
    throw new Error(`Failed to create game: ${gameResponse.status()} ${await gameResponse.text()}`);
  }
  const game = await gameResponse.json();

  const patchResponse = await request.patch(`${BASE_URL}/api/games/${game.id}`, {
    data: {
      collaborationMode: "group",
      isPublic: true,
      drawboardCaptureMode: "browser",
      manualDrawboardCapture: false,
    },
  });
  if (!patchResponse.ok()) {
    throw new Error(`Failed to configure game: ${patchResponse.status()} ${await patchResponse.text()}`);
  }

  const levelResponse = await request.post(`${BASE_URL}/api/levels`, {
    data: creatorStarterLevel(),
  });
  if (!levelResponse.ok()) {
    throw new Error(`Failed to create level: ${levelResponse.status()} ${await levelResponse.text()}`);
  }
  const level = await levelResponse.json();

  const attachResponse = await request.post(`${BASE_URL}/api/maps/levels/${encodeURIComponent(game.mapName)}`, {
    data: { levels: [level.identifier] },
  });
  if (!attachResponse.ok()) {
    throw new Error(`Failed to attach level to map: ${attachResponse.status()} ${await attachResponse.text()}`);
  }

  return { game, level };
}

async function createGroup(request, gameId) {
  const groupName = `pw-evt-accuracy-${Date.now().toString(36)}`;
  const createResponse = await request.post(`${BASE_URL}/api/groups`, {
    data: { name: groupName, resourceLinkId: gameId },
  });
  if (!createResponse.ok()) {
    throw new Error(`Failed to create group: ${createResponse.status()} ${await createResponse.text()}`);
  }
  const created = await createResponse.json();
  const groupId = created.group?.id;
  if (!groupId) {
    throw new Error(`Group create response did not include an id: ${JSON.stringify(created)}`);
  }

  const detailsResponse = await request.get(`${BASE_URL}/api/groups/${groupId}`);
  if (!detailsResponse.ok()) {
    throw new Error(`Failed to fetch group details: ${detailsResponse.status()} ${await detailsResponse.text()}`);
  }
  const details = await detailsResponse.json();
  const joinKey = details.group?.joinKey;
  if (!joinKey) {
    throw new Error(`Group ${groupId} did not expose a join key`);
  }

  return { groupId, groupName, joinKey };
}

async function joinGroup(request, groupId, joinKey) {
  const response = await request.post(`${BASE_URL}/api/groups/${groupId}/members`, {
    data: { joinKey },
  });
  if (!response.ok()) {
    throw new Error(`Failed to join group ${groupId}: ${response.status()} ${await response.text()}`);
  }
}

async function fetchGroupInstance(request, gameId, groupId) {
  const response = await request.get(`${BASE_URL}/api/games/${gameId}/instance?accessContext=game&groupId=${groupId}`);
  if (!response.ok()) {
    throw new Error(`Failed to fetch group instance: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

async function waitForEditor(page) {
  try {
    await page.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: TIMEOUT_MS });
  } catch (error) {
    const url = page.url();
    const bodyText = ((await page.locator("body").textContent().catch(() => "")) || "").slice(0, 800);
    throw new Error(`Editor did not become ready at ${url}. Body snapshot: ${JSON.stringify(bodyText)}`, {
      cause: error,
    });
  }
}

async function waitForGameEditor(page, label) {
  const waitingRoom = page.getByText("Group Waiting Room");
  await Promise.race([
    waitingRoom.first().waitFor({ timeout: 15_000 }).catch(() => null),
    page.locator(".cm-content[contenteditable='true']").first().waitFor({ timeout: 15_000 }).catch(() => null),
  ]);

  if ((await waitingRoom.count()) > 0) {
    const startButton = page.getByRole("button", { name: "Start Game" });
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      const editorVisible = await page.locator(".cm-content[contenteditable='true']").first().isVisible().catch(() => false);
      if (editorVisible) {
        break;
      }
      const startVisible = await startButton.isVisible().catch(() => false);
      const startEnabled = startVisible && await startButton.isEnabled().catch(() => false);
      if (startEnabled) {
        await startButton.click();
      }
      await page.waitForTimeout(500);
    }
  }

  await waitForEditor(page);
  console.log(`game editor ready (${label})`);
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

async function replaceEditorText(page, searchValue, replaceValue, label) {
  const replacement = await page.evaluate(({ nextSearchValue, nextReplaceValue }) => {
    const editableContent = document.querySelector(".cm-content[contenteditable='true']");
    if (!editableContent) {
      return { ok: false, reason: "missing-editor" };
    }
    const cmEditorEl = editableContent.closest(".cm-editor");
    if (!cmEditorEl) {
      return { ok: false, reason: "missing-cm-editor" };
    }
    const findCmView = (function findCmView(el) {
      const content = el.querySelector(".cm-content") ?? el;
      let tile = content?.cmTile ?? el?.cmTile;
      let view = tile?.root?.view ?? null;
      if (view) return view;
      return el?.cmView?.view ?? content?.parentNode?.cmView?.view ?? content?.cmView?.view ?? null;
    });
    const view = findCmView(cmEditorEl);
    if (!view?.state?.doc) {
      return { ok: false, reason: "missing-view" };
    }
    const current = view.state.doc.toString();
    if (!current.includes(nextSearchValue)) {
      return { ok: false, reason: "missing-search", current };
    }
    const next = current.replace(nextSearchValue, nextReplaceValue);
    if (next === current) {
      return { ok: false, reason: "unchanged", current };
    }
    view.dispatch({
      changes: { from: 0, to: current.length, insert: next },
      selection: { anchor: Math.min(next.length, next.indexOf(nextReplaceValue) + nextReplaceValue.length) },
      scrollIntoView: true,
    });
    view.focus();
    return { ok: true, next };
  }, { nextSearchValue: searchValue, nextReplaceValue: replaceValue });

  if (!replacement?.ok) {
    throw new Error(`Editor replacement failed for ${label}: ${JSON.stringify(replacement)}`);
  }
}

function readPointsByLevelEntry(progressData, levelName) {
  const pointsByLevel = progressData?.pointsByLevel;
  if (!pointsByLevel || typeof pointsByLevel !== "object" || Array.isArray(pointsByLevel)) {
    return null;
  }
  const entry = pointsByLevel[levelName];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  return {
    points: typeof entry.points === "number" ? entry.points : null,
    maxPoints: typeof entry.maxPoints === "number" ? entry.maxPoints : null,
    accuracy: typeof entry.accuracy === "number" ? entry.accuracy : null,
    bestTime: typeof entry.bestTime === "string" ? entry.bestTime : null,
    scenarios: Array.isArray(entry.scenarios)
      ? entry.scenarios.map((scenario) => ({
        scenarioId: String(scenario.scenarioId),
        accuracy: typeof scenario.accuracy === "number" ? scenario.accuracy : null,
      }))
      : [],
  };
}

async function getVisibleMeanAccuracy(page) {
  const payload = await page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden"
        && style.display !== "none"
        && rect.width > 0
        && rect.height > 0;
    };

    const candidates = [...document.querySelectorAll("p.select-none, div")]
      .filter((node) => isVisible(node))
      .map((node) => (node.textContent || "").trim())
      .filter((text) => /^\d+(?:\.\d+)?%$/.test(text));

    return {
      candidates,
    };
  });

  const uniqueCandidates = [...new Set(payload.candidates)];
  if (uniqueCandidates.length !== 1) {
    throw new Error(`Expected exactly one visible mean accuracy candidate, got ${JSON.stringify(uniqueCandidates)}`);
  }

  return uniqueCandidates[0];
}

async function getAccuracySnapshot(page, request, gameId, groupId, levelName, label) {
  const instancePayload = await fetchGroupInstance(request, gameId, groupId);
  const entry = readPointsByLevelEntry(instancePayload?.instance?.progressData, levelName);
  const uiAccuracyText = await getVisibleMeanAccuracy(page);
  const uiAccuracy = Number.parseFloat(uiAccuracyText.replace("%", ""));

  return {
    label,
    instanceId: String(instancePayload.instance.id),
    uiAccuracyText,
    uiAccuracy,
    entry,
    progressData: instancePayload.instance.progressData,
  };
}

function totalPointsFromEntry(entry) {
  return {
    points: typeof entry?.points === "number" ? entry.points : 0,
    maxPoints: typeof entry?.maxPoints === "number" ? entry.maxPoints : 0,
  };
}

async function assertSharedAccuracyConsistency({
  creatorPage,
  memberPage,
  creatorRequest,
  memberRequest,
  gameId,
  groupId,
  levelName,
  phaseLabel,
  baselineInstanceId,
}) {
  let stableHits = 0;
  let lastSignature = null;
  let finalSnapshots = null;

  try {
    await expect.poll(async () => {
      const [creatorSnapshot, memberSnapshot] = await Promise.all([
        getAccuracySnapshot(creatorPage, creatorRequest, gameId, groupId, levelName, "creator"),
        getAccuracySnapshot(memberPage, memberRequest, gameId, groupId, levelName, "member"),
      ]);

      const creatorEntryJson = JSON.stringify(creatorSnapshot.entry);
      const memberEntryJson = JSON.stringify(memberSnapshot.entry);
      const creatorMatchesBackend = creatorSnapshot.entry?.accuracy === creatorSnapshot.uiAccuracy;
      const memberMatchesBackend = memberSnapshot.entry?.accuracy === memberSnapshot.uiAccuracy;
      const instanceIdStable = baselineInstanceId
        ? creatorSnapshot.instanceId === baselineInstanceId
        : true;
      const equal =
        creatorSnapshot.instanceId === memberSnapshot.instanceId
        && creatorSnapshot.uiAccuracyText === memberSnapshot.uiAccuracyText
        && creatorEntryJson === memberEntryJson
        && creatorSnapshot.entry !== null
        && creatorMatchesBackend
        && memberMatchesBackend
        && instanceIdStable;

      const signature = JSON.stringify({
        instanceId: creatorSnapshot.instanceId,
        ui: creatorSnapshot.uiAccuracyText,
        entry: creatorSnapshot.entry,
      });

      if (equal && signature === lastSignature) {
        stableHits += 1;
      } else if (equal) {
        stableHits = 1;
        lastSignature = signature;
      } else {
        stableHits = 0;
        lastSignature = null;
      }

      finalSnapshots = {
        creatorSnapshot,
        memberSnapshot,
        stableHits,
      };

      return stableHits >= 2;
    }, {
      timeout: TIMEOUT_MS,
      message: `Expected shared level accuracy to converge for ${phaseLabel}`,
    }).toBe(true);
  } catch (error) {
    // Rich failure diagnostics: dump both users' UI + backend state
    console.error(`\n=== ACCURACY CONSISTENCY FAILURE: ${phaseLabel} ===`);
    if (finalSnapshots) {
      const { creatorSnapshot, memberSnapshot } = finalSnapshots;
      console.error("Creator UI accuracy:", creatorSnapshot?.uiAccuracyText);
      console.error("Member  UI accuracy:", memberSnapshot?.uiAccuracyText);
      console.error("Creator instanceId:", creatorSnapshot?.instanceId);
      console.error("Member  instanceId:", memberSnapshot?.instanceId);
      if (baselineInstanceId) {
        console.error("Baseline instanceId:", baselineInstanceId);
        console.error("Instance ID drifted:", creatorSnapshot?.instanceId !== baselineInstanceId);
      }
      console.error("Creator backend entry:", JSON.stringify(creatorSnapshot?.entry, null, 2));
      console.error("Member  backend entry:", JSON.stringify(memberSnapshot?.entry, null, 2));
      console.error("Creator UI matches backend:", creatorSnapshot?.entry?.accuracy === creatorSnapshot?.uiAccuracy);
      console.error("Member  UI matches backend:", memberSnapshot?.entry?.accuracy === memberSnapshot?.uiAccuracy);
      const creatorFinish = creatorSnapshot?.progressData?.userFinishStates;
      const memberFinish = memberSnapshot?.progressData?.userFinishStates;
      if (creatorFinish || memberFinish) {
        console.error("Creator userFinishStates:", JSON.stringify(creatorFinish, null, 2));
        console.error("Member  userFinishStates:", JSON.stringify(memberFinish, null, 2));
      }
      console.error("Stable hits reached:", finalSnapshots.stableHits);
    } else {
      console.error("No snapshots captured before timeout.");
    }
    console.error(`=== END FAILURE DUMP ===\n`);
    throw error;
  }

  console.log(`shared accuracy consistent (${phaseLabel})`, {
    instanceId: finalSnapshots.creatorSnapshot.instanceId,
    uiAccuracy: finalSnapshots.creatorSnapshot.uiAccuracyText,
    pointsByLevel: finalSnapshots.creatorSnapshot.entry,
    scenarios: finalSnapshots.creatorSnapshot.entry?.scenarios ?? [],
  });

  return finalSnapshots;
}

async function waitForEditorContentContains(page, expectedText, label) {
  await expect.poll(async () => {
    return await getEditableContent(page);
  }, {
    timeout: TIMEOUT_MS,
    message: `Expected editor content to include ${JSON.stringify(expectedText)} for ${label}`,
  }).toContain(expectedText);
}

async function submitFinishedAttempt(request, gameId, groupId, progressData, entry) {
  const totals = totalPointsFromEntry(entry);
  const response = await request.post(
    `${BASE_URL}/api/games/${gameId}/finish?accessContext=game&groupId=${encodeURIComponent(groupId)}`,
    {
      data: {
        points: totals.points,
        maxPoints: totals.maxPoints || 100,
        progressData,
        pointsByLevel: {
          [LEVEL_NAME]: entry,
        },
      },
    },
  );
  if (!response.ok()) {
    throw new Error(`Failed to submit finished attempt: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  if (!payload?.success) {
    throw new Error(`Finish payload was not successful: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function findVisibleDrawboardFrame(page, { retries = 3, stabilityMs = 1000 } = {}) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const byTestId = page.getByTestId("creator-template-drawboard-frame");
    const iframe = (await byTestId.count()) > 0
      ? byTestId
      : page.locator('iframe[src*="name=drawingUrl"]:not([aria-hidden="true"])').filter({ visible: true }).last();
    await iframe.waitFor({ state: "visible", timeout: TIMEOUT_MS });
    await page.waitForTimeout(stabilityMs);
    const handle = await iframe.elementHandle();
    const frame = await handle?.contentFrame();
    if (!frame) {
      if (attempt < retries - 1) {
        console.log(`Frame not ready (attempt ${attempt + 1}/${retries}), retrying...`);
        continue;
      }
      throw new Error("Could not find visible drawing iframe");
    }
    try {
      await frame.evaluate(() => document.readyState);
      return frame;
    } catch {
      if (attempt < retries - 1) {
        console.log(`Frame detached (attempt ${attempt + 1}/${retries}), retrying...`);
        continue;
      }
      throw new Error("Drawing iframe frame keeps detaching");
    }
  }
  throw new Error("Could not find stable drawing iframe");
}

async function dismissJoyrideTour(page) {
  const joyridePortal = page.locator("#react-joyride-portal");
  if (await joyridePortal.count()) {
    const skipBtn = page.locator('[data-action="skip"], [aria-label="Skip"], [aria-label="Close"]').first();
    if (await skipBtn.count()) {
      await skipBtn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.evaluate(() => {
      const portal = document.getElementById("react-joyride-portal");
      if (portal) portal.remove();
    });
    await page.waitForTimeout(200);
  }
}

async function assertArtboardStepScrubAfterPersist(page) {
  await dismissJoyrideTour(page);

  const stepInitial = page.locator('button[aria-label="Event 1"]');
  const stepAfterFirstInteraction = page.locator('button[aria-label="Event 2"]');

  await stepInitial.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  await stepAfterFirstInteraction.waitFor({ state: "visible", timeout: TIMEOUT_MS });

  // Initial state is already selected by default once strip opens; scrub forward first.
  await stepAfterFirstInteraction.click();
  await expect.poll(async () => {
    const drawing = await findVisibleDrawboardFrame(page);
    return (await drawing.locator("#status").textContent())?.trim() ?? "";
  }, {
    timeout: TIMEOUT_MS,
    message: "Expected template drawboard to replay click and show Open after selecting step 2",
  }).toBe("Open");

  await stepInitial.click();
  await expect.poll(async () => {
    const drawing = await findVisibleDrawboardFrame(page);
    return (await drawing.locator("#status").textContent())?.trim() ?? "";
  }, {
    timeout: TIMEOUT_MS,
    message: "Expected template drawboard to reset to Closed after selecting initial state",
  }).toBe("Closed");

  await stepAfterFirstInteraction.click();
  await expect.poll(async () => {
    const drawing = await findVisibleDrawboardFrame(page);
    return (await drawing.locator("#status").textContent())?.trim() ?? "";
  }, {
    timeout: TIMEOUT_MS,
    message: "Expected template drawboard to replay click again after returning to step 2",
  }).toBe("Open");
}

async function ensureCreatorInteractivePreview(page) {
  const toggle = page.locator('button[aria-label="Switch to live"]:visible').first();
  if (await toggle.count()) {
    await toggle.evaluate((element) => {
      element.click();
    });
  }
}

async function ensureLiveModeForRecording(page) {
  // Wait for the mode toggle to appear — it only renders once a scenario is selected.
  const liveToggle = page.locator("#events-interaction-mode").first();
  const recordButton = page.locator("#events-record-sequence").first();
  try {
    await liveToggle.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  } catch {
    // Button never appeared — scenario may not have loaded.
    return;
  }
  const pressed = await liveToggle.getAttribute("aria-pressed");
  if (pressed !== "true") {
    await liveToggle.click();
  }
  // Wait until record button is actually enabled after any rerender.
  await expect(recordButton).toBeEnabled({ timeout: TIMEOUT_MS });
}

async function startSequenceRecording(page) {
  await ensureLiveModeForRecording(page);
  const startButton = page.locator("#events-record-sequence").first();
  await startButton.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  await startButton.click();
  await page.waitForTimeout(500);
  const vp = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.move(vp.width - 2, vp.height - 2);
  await page.waitForTimeout(200);
  await expect(page.locator("#events-stop-recording").first()).toBeVisible({ timeout: TIMEOUT_MS });
  await page.waitForTimeout(500);
}

async function stopSequenceRecording(page) {
  const stopButton = page.locator("#events-stop-recording").first();
  await stopButton.waitFor({ state: "visible", timeout: TIMEOUT_MS });
  await stopButton.evaluate((element) => {
    element.click();
  });
  await expect(page.locator("#events-record-sequence").first()).toBeVisible({ timeout: TIMEOUT_MS });
  await page.waitForTimeout(300);
}

async function interactWithDrawboard(frame, nameValue) {
  const initialStatus = ((await frame.locator("#status").textContent()) || "").trim();
  const expectedStatus = initialStatus === "Open" ? "Closed" : "Open";

  const toggled = await frame.evaluate(() => {
    const button = document.getElementById("toggle");
    if (!(button instanceof HTMLButtonElement)) {
      return false;
    }
    button.click();
    return true;
  });
  if (!toggled) {
    throw new Error("Could not trigger toggle interaction inside drawboard");
  }
  try {
    await expect(frame.locator("#status")).toHaveText(expectedStatus, { timeout: TIMEOUT_MS });
  } catch (error) {
    const debugState = await frame.evaluate(() => {
      const status = document.getElementById("status");
      const overlay = document.querySelector('[role="alert"]');
      const userScript = document.querySelector('script[data-user="true"]');
      return {
        statusText: status?.textContent || null,
        statusDataOpen: status?.getAttribute("data-open") || null,
        hasErrorOverlay: Boolean(overlay),
        overlayText: overlay?.textContent || null,
        hasUserScript: Boolean(userScript),
        bodyText: document.body.innerText.slice(0, 600),
      };
    });
    throw new Error(`Toggle interaction did not change drawboard state from ${JSON.stringify(initialStatus)} to ${JSON.stringify(expectedStatus)}: ${JSON.stringify(debugState)}`, {
      cause: error,
    });
  }
  await frame.waitForTimeout(500);

  const filled = await frame.evaluate((nextValue) => {
    const input = document.getElementById("name-input");
    if (!(input instanceof HTMLInputElement)) {
      return false;
    }
    input.focus();
    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, nameValue);
  if (!filled) {
    throw new Error("Could not trigger input interaction inside drawboard");
  }
  await expect(frame.locator("#mirror")).toHaveText(nameValue, { timeout: TIMEOUT_MS });
  await frame.waitForTimeout(500);
}

async function persistCreatorInteractions(page, request, levelIdentifier, expectedCount) {
  const inlineSave = page.getByRole("button", { name: /^Save$/ }).first();
  const hasInlineSave = await inlineSave.count();

  if (hasInlineSave) {
    const waitForSave = page.waitForResponse((response) => {
      return response.url().includes(`/api/levels/${levelIdentifier}`) && response.request().method() === "PUT";
    }, { timeout: 5000 }).then(() => true).catch(() => false);

    await inlineSave.click();

    const didSave = await waitForSave;
    if (didSave) {
      return;
    }
  }

  await expect.poll(async () => {
    const level = await fetchLevel(request, levelIdentifier);
    return level.eventSequence?.byScenarioId?.[SCENARIO_ID]?.length || 0;
  }, {
    timeout: TIMEOUT_MS,
    message: `Expected ${expectedCount} event sequence steps to persist after creator interactions`,
  }).toBe(expectedCount);
}

async function fetchLevel(request, levelIdentifier) {
  const response = await request.get(`${BASE_URL}/api/levels/${levelIdentifier}`);
  if (!response.ok()) {
    throw new Error(`Failed to fetch level ${levelIdentifier}: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

async function waitForVerifiedInteractions(request, levelIdentifier, expectedCount) {
  await expect.poll(async () => {
    const level = await fetchLevel(request, levelIdentifier);
    return level.eventSequence?.byScenarioId?.[SCENARIO_ID]?.length || 0;
  }, {
    timeout: TIMEOUT_MS,
    message: `Expected ${expectedCount} event sequence steps to persist`,
  }).toBe(expectedCount);
}

async function assertCreatorPersistence(request, levelIdentifier) {
  const level = await fetchLevel(request, levelIdentifier);
  const steps = level.eventSequence?.byScenarioId?.[SCENARIO_ID] || [];

  expect(steps).toHaveLength(2);
  expect(steps.map((entry) => entry.eventType)).toEqual(["click", "input"]);
  expect(steps.every((entry) => entry.snapshot?.snapshotHtml && entry.snapshot?.css !== undefined)).toBeTruthy();
  expect(steps.every((entry) => entry.instruction && entry.label)).toBeTruthy();
}

async function assertGroupMemberSeesConsistentEventSequence(memberRequest, creatorRequest, levelIdentifier) {
  const [memberLevel, creatorLevel] = await Promise.all([
    fetchLevel(memberRequest, levelIdentifier),
    fetchLevel(creatorRequest, levelIdentifier),
  ]);

  const memberSteps = memberLevel.eventSequence?.byScenarioId?.[SCENARIO_ID] || [];
  const creatorSteps = creatorLevel.eventSequence?.byScenarioId?.[SCENARIO_ID] || [];

  expect(memberSteps.length).toBe(creatorSteps.length);
  expect(memberSteps.length).toBeGreaterThan(0);
  expect(memberSteps.map((entry) => entry.eventType)).toEqual(creatorSteps.map((entry) => entry.eventType));
  expect(memberSteps.map((entry) => entry.id)).toEqual(creatorSteps.map((entry) => entry.id));
}

async function assertGroupInstanceConsistency(creatorRequest, memberRequest, gameId, groupId) {
  const [creatorInstance, memberInstance] = await Promise.all([
    fetchGroupInstance(creatorRequest, gameId, groupId),
    fetchGroupInstance(memberRequest, gameId, groupId),
  ]);

  expect(creatorInstance.instance).toBeDefined();
  expect(memberInstance.instance).toBeDefined();

  expect(creatorInstance.instance.scope).toBe("group");
  expect(memberInstance.instance.scope).toBe("group");

  // Both see the same group instance (same id)
  expect(String(creatorInstance.instance.id)).toBe(String(memberInstance.instance.id));

  expect(creatorInstance.instance.groupId).toBe(groupId);
  expect(memberInstance.instance.groupId).toBe(groupId);

  // Both see identical progressData for the shared group instance
  expect(JSON.stringify(creatorInstance.instance.progressData)).toBe(
    JSON.stringify(memberInstance.instance.progressData),
  );
}

async function deleteGame(request, gameId) {
  const response = await request.delete(`${BASE_URL}/api/games/${gameId}`);
  if (!response.ok()) {
    console.warn(`Failed to delete game ${gameId}: ${response.status()} ${await response.text()}`);
  } else {
    console.log(`Cleaned up game ${gameId}`);
  }
}

async function acknowledgeTourSpots(request) {
  const res = await request.patch(`${BASE_URL}/api/user/tour-spots`, { data: { acks: TOUR_SPOT_ACKS } });
  if (!res.ok()) {
    console.warn("Failed to pre-ack tour spots:", res.status(), await res.text());
  }
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const creatorContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const memberContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });

  const creatorPage = await creatorContext.newPage();
  const memberPage = await memberContext.newPage();

  let gameId = null;

  try {
    // --- Sign in both users ---
    await signInDevUser(creatorPage, DEV_USERNAME_CREATOR);
    await acknowledgeTourSpots(creatorContext.request);
    console.log(`signed in creator (${DEV_USERNAME_CREATOR})`);

    await signInDevUser(memberPage, DEV_USERNAME_MEMBER);
    await acknowledgeTourSpots(memberContext.request);
    console.log(`signed in member (${DEV_USERNAME_MEMBER})`);

    // --- Creator sets up the group game and level ---
    const { game, level } = await createGameWithLevel(creatorContext.request);
    gameId = game.id;
    console.log("created group game and level", { gameId: game.id, levelIdentifier: level.identifier, collaborationMode: "group" });

    // --- Creator creates a group and member joins ---
    const { groupId, joinKey } = await createGroup(creatorContext.request, game.id);
    console.log("group created", { groupId });

    await joinGroup(memberContext.request, groupId, joinKey);
    console.log(`member joined group ${groupId}`);

    // --- Creator records event sequence on the creator page ---
    await creatorPage.goto(`${BASE_URL}/creator/${game.id}`, { waitUntil: "domcontentloaded" });
    await waitForEditor(creatorPage);
    console.log("creator page ready");

    await ensureCreatorInteractivePreview(creatorPage);
    await startSequenceRecording(creatorPage);
    console.log("event sequence recording started");

    const creatorFrame = await findVisibleDrawboardFrame(creatorPage);
    await interactWithDrawboard(creatorFrame, TARGET_NAME);
    await creatorPage.waitForTimeout(1400);
    await stopSequenceRecording(creatorPage);
    console.log("creator interactions executed");

    await persistCreatorInteractions(creatorPage, creatorContext.request, level.identifier, 2);
    console.log("creator interactions persisted");
    await waitForVerifiedInteractions(creatorContext.request, level.identifier, 2);
    console.log("verified interactions persisted");
    await assertCreatorPersistence(creatorContext.request, level.identifier);
    console.log("creator persistence asserted");

    await ensureCreatorInteractivePreview(creatorPage);
    await assertArtboardStepScrubAfterPersist(creatorPage);
    console.log("artboard step scrub assertions passed");

    // --- Verify member sees same event sequence as creator (consistency check) ---
    await assertGroupMemberSeesConsistentEventSequence(
      memberContext.request,
      creatorContext.request,
      level.identifier,
    );
    console.log("event sequence consistency verified: member and creator see identical steps");

    // --- Open same shared group game for both users ---
    const gameUrl = `${BASE_URL}/game/${game.id}?mode=game&groupId=${groupId}&skipWaiting=1`;
    await creatorPage.goto(gameUrl, { waitUntil: "domcontentloaded" });
    await waitForGameEditor(creatorPage, "creator");
    console.log("creator game page ready");

    const memberGameUrl = `${BASE_URL}/game/${game.id}?mode=game&groupId=${groupId}&skipWaiting=1`;
    await memberPage.goto(memberGameUrl, { waitUntil: "load", timeout: TIMEOUT_MS });
    await waitForGameEditor(memberPage, "member");
    console.log("member game page ready");

    // Group instance should now exist — verify it before live gameplay sync assertions
    const instanceBefore = await fetchGroupInstance(creatorContext.request, game.id, groupId);
    expect(instanceBefore.instance).toBeDefined();
    expect(instanceBefore.instance.scope).toBe("group");
    expect(instanceBefore.instance.groupId).toBe(groupId);
    console.log("group instance exists before game interaction", { instanceId: instanceBefore.instance.id });

    // --- Baseline: both users hydrate same group accuracy and shared pointsByLevel ---
    const baselineSnapshots = await assertSharedAccuracyConsistency({
      creatorPage,
      memberPage,
      creatorRequest: creatorContext.request,
      memberRequest: memberContext.request,
      gameId: game.id,
      groupId,
      levelName: LEVEL_NAME,
      phaseLabel: "baseline",
    });
    const baselineInstanceId = baselineSnapshots.creatorSnapshot.instanceId;

    // --- Creator changes shared code enough to move accuracy ---
    await replaceEditorText(creatorPage, "Toggle details", "Reveal details", "creator live edit");
    await waitForEditorContentContains(memberPage, "Reveal details", "member after creator edit");
    const afterCreatorEdit = await assertSharedAccuracyConsistency({
      creatorPage,
      memberPage,
      creatorRequest: creatorContext.request,
      memberRequest: memberContext.request,
      gameId: game.id,
      groupId,
      levelName: LEVEL_NAME,
      phaseLabel: "creator live edit",
      baselineInstanceId,
    });

    // --- Member changes shared code enough to move accuracy again ---
    await replaceEditorText(memberPage, "Name", "Display name", "member live edit");
    await waitForEditorContentContains(creatorPage, "Display name", "creator after member edit");
    const afterMemberEdit = await assertSharedAccuracyConsistency({
      creatorPage,
      memberPage,
      creatorRequest: creatorContext.request,
      memberRequest: memberContext.request,
      gameId: game.id,
      groupId,
      levelName: LEVEL_NAME,
      phaseLabel: "member live edit",
      baselineInstanceId,
    });

    // --- Concurrent/race phase: both users update visible shared code at nearly same time ---
    await Promise.all([
      replaceEditorText(creatorPage, "Reveal details", "Reveal team details", "creator race edit"),
      replaceEditorText(memberPage, "Type a name", "Type team name", "member race edit"),
    ]);
    await waitForEditorContentContains(creatorPage, "Type team name", "creator after race edit");
    await waitForEditorContentContains(memberPage, "Reveal team details", "member after race edit");
    const afterRaceEdit = await assertSharedAccuracyConsistency({
      creatorPage,
      memberPage,
      creatorRequest: creatorContext.request,
      memberRequest: memberContext.request,
      gameId: game.id,
      groupId,
      levelName: LEVEL_NAME,
      phaseLabel: "concurrent live edit",
      baselineInstanceId,
    });

    // --- Reload/rejoin: one member comes back and rehydrates same shared accuracy ---
    await memberPage.reload({ waitUntil: "domcontentloaded" });
    await waitForGameEditor(memberPage, "member reload");
    const afterReload = await assertSharedAccuracyConsistency({
      creatorPage,
      memberPage,
      creatorRequest: creatorContext.request,
      memberRequest: memberContext.request,
      gameId: game.id,
      groupId,
      levelName: LEVEL_NAME,
      phaseLabel: "reload rejoin",
      baselineInstanceId,
    });

    const latestSharedEntry = afterReload.creatorSnapshot.entry;
    expect(latestSharedEntry).toBeTruthy();

    // --- Regression proof: isolated creator playback interaction must not mutate creator-set event sequence ---
    const playbackPage = await creatorContext.newPage();
    await playbackPage.goto(gameUrl, { waitUntil: "domcontentloaded" });
    await waitForGameEditor(playbackPage, "creator playback");
    const gameFrame = await findVisibleDrawboardFrame(playbackPage, { retries: 3, stabilityMs: 1500 });
    await interactWithDrawboard(gameFrame, "Group event");
    console.log("creator playback drawboard interactions executed");
    await playbackPage.close();

    // --- Verify the group instance after isolated playback interaction ---
    const instanceAfterCreator = await fetchGroupInstance(creatorContext.request, game.id, groupId);
    expect(instanceAfterCreator.instance.id).toBe(instanceBefore.instance.id);
    console.log("group instance stable after creator game interaction");

    // --- Member verifies they see the same group instance and same event sequence ---
    await assertGroupInstanceConsistency(
      creatorContext.request,
      memberContext.request,
      game.id,
      groupId,
    );
    console.log("group instance consistency verified: creator and member see identical shared instance");

    // --- Event sequence on the level must not have been modified by game interaction ---
    const levelAfterGame = await fetchLevel(creatorContext.request, level.identifier);
    const stepsAfterGame = levelAfterGame.eventSequence?.byScenarioId?.[SCENARIO_ID] || [];
    expect(stepsAfterGame).toHaveLength(2);
    expect(stepsAfterGame.map((entry) => entry.eventType)).toEqual(["click", "input"]);
    console.log("event sequence steps on level unchanged after game interaction (2 steps, creator-set)");

    // --- Finish/submit phase: shared pointsByLevel must remain stable through userFinishStates merge ---
    const finishPayloadOne = await submitFinishedAttempt(
      memberContext.request,
      game.id,
      groupId,
      afterRaceEdit.creatorSnapshot.progressData,
      latestSharedEntry,
    );
    expect(finishPayloadOne.instance.progressData.userFinishStates).toBeDefined();
    console.log("first finish submitted", {
      attemptId: finishPayloadOne.statistics?.attemptId ?? null,
      userFinishStateCount: Object.keys(finishPayloadOne.instance.progressData.userFinishStates || {}).length,
    });
    await assertSharedAccuracyConsistency({
      creatorPage,
      memberPage,
      creatorRequest: creatorContext.request,
      memberRequest: memberContext.request,
      gameId: game.id,
      groupId,
      levelName: LEVEL_NAME,
      phaseLabel: "after first finish",
      baselineInstanceId,
    });

    const finishPayloadTwo = await submitFinishedAttempt(
      creatorContext.request,
      game.id,
      groupId,
      finishPayloadOne.instance.progressData,
      latestSharedEntry,
    );
    expect(Object.keys(finishPayloadTwo.instance.progressData.userFinishStates || {})).toHaveLength(2);
    console.log("second finish submitted", {
      attemptId: finishPayloadTwo.statistics?.attemptId ?? null,
      userFinishStateCount: Object.keys(finishPayloadTwo.instance.progressData.userFinishStates || {}).length,
    });
    await assertSharedAccuracyConsistency({
      creatorPage,
      memberPage,
      creatorRequest: creatorContext.request,
      memberRequest: memberContext.request,
      gameId: game.id,
      groupId,
      levelName: LEVEL_NAME,
      phaseLabel: "after second finish",
      baselineInstanceId,
    });

    // --- Final consistency: member fetches the same level and sees the same steps ---
    await assertGroupMemberSeesConsistentEventSequence(
      memberContext.request,
      creatorContext.request,
      level.identifier,
    );
    console.log("final event sequence consistency check passed");

    console.log("Playwright event sequence artboard group accuracy smoke test passed.", {
      gameId: game.id,
      levelIdentifier: level.identifier,
      groupId,
      eventSteps: stepsAfterGame.length,
      baselineAccuracy: afterCreatorEdit.creatorSnapshot.uiAccuracyText,
      finalAccuracy: afterReload.creatorSnapshot.uiAccuracyText,
    });
  } finally {
    if (gameId) {
      await deleteGame(creatorContext.request, gameId).catch((error) => {
        console.warn("Game cleanup failed:", error);
      });
    }
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Playwright event sequence artboard group accuracy smoke test failed.", error);
  process.exitCode = 1;
});
