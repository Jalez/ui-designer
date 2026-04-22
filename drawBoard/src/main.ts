import { domToPng } from "modern-screenshot";
import {
  buildDraftEventStepCopy,
  computePixelSignature,
  createDrawboardSnapshot,
  createSnapshotPayload,
  EventSequenceStep,
  getPixelData,
  hashDrawboardSnapshot,
  InteractionTrigger,
  loadImage,
  normalizeInteractionTriggers,
  selectorFromEventTarget,
  setStyles,
  summarizeEventTarget,
  VerifiedInteraction,
} from "./utils";

type ErrorObj = {
  message: string;
  lineno?: number;
  colno?: number;
};

type DrawboardPayload = {
  name?: string;
  message?: string;
  scenarioId?: string;
  html?: string;
  css?: string;
  js?: string;
  events?: unknown;
  interactive?: boolean;
  isCreator?: boolean;
  recordingSequence?: boolean;
  selectedReplayStepId?: string | null;
  replaySequence?: EventSequenceStep[];
  runId?: number;
  visibleStepIds?: string[];
};

type VisualState = {
  snapshotHash: string;
  pixelHash: string | null;
};

type TriggerCandidate = {
  trigger: InteractionTrigger;
  targetSummary?: string;
  keyPressed?: string;
  showInTimeline?: boolean;
};

const params = new URLSearchParams(window.location.search);
const urlName = params.get("name") || "";
const scenarioId = params.get("scenarioId") || "";
const scenarioWidth = parseInt(params.get("width") || "0", 10);
const scenarioHeight = parseInt(params.get("height") || "0", 10);
const captureMode = params.get("captureMode") || "playwright";
const isBrowserCapture = captureMode === "browser";
const manualRaw = (params.get("manualCapture") || "").trim().toLowerCase();
const isManualCapture = manualRaw === "true" || manualRaw === "1";

const PLAYWRIGHT_RENDER_READY_DELAY_MS = 80;
const PLAYWRIGHT_LAYOUT_FOLLOW_UP_MS = 400;
const INTERACTION_SETTLE_DELAY_MS = 120;
const REPLAY_SELECTOR_WAIT_MS = 1200;

function applyScenarioDocumentBox() {
  const w = scenarioWidth ? `${scenarioWidth}px` : "100%";
  const h = scenarioHeight ? `${scenarioHeight}px` : "100%";
  document.documentElement.style.width = w;
  document.documentElement.style.height = h;
  document.body.style.width = w;
  document.body.style.height = h;
}

applyScenarioDocumentBox();

let errorOverlay: HTMLDivElement | null = null;
let dataReceived = false;
let stylesCorrect = false;
let jsCorrect = false;
let interactive = false;
let triggers: InteractionTrigger[] = [];
let recordingSequence = false;
let mountedIntervalId: number | null = null;
let renderReadyTimeoutId: number | null = null;
let playwrightLayoutFollowUpId: number | null = null;
let currentScript: HTMLScriptElement | null = null;
let currentScriptUrl: string | null = null;
let manualModeBootstrapCapturePending = true;
let interactionVerificationTimeoutId: number | null = null;
let interactionVerificationInFlight = false;
let pendingCandidate: TriggerCandidate | null = null;
let acceptedVisualState: VisualState | null = null;
let interactionSequence = 0;
let domMutationVersion = 0;
let layoutMutationVersion = 0;
let mutationObserver: MutationObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let replaySequence: EventSequenceStep[] = [];
let replayInFlight = false;
let replayAppliedSignature = "";
let selectedReplayStepId: string | null = null;
let replayPromise: Promise<void> | null = null;
let replayBatchRunId: number | null = null;
let replayBatchCancelledRunId: number | null = null;
let pendingReplayBatchRequest: {
  runId: number;
  steps: EventSequenceStep[];
  visibleStepIds: string[];
} | null = null;
function postReplayStatus(payload: {
  status: "run-started" | "step-started" | "step-completed" | "step-skipped" | "run-completed";
  signature?: string;
  stepId?: string;
  selector?: string | null;
  reason?: string | null;
  index?: number | null;
  totalSteps?: number;
}) {
  window.parent.postMessage(
    {
      message: "event-sequence-replay-status",
      name: urlName,
      scenarioId,
      ...payload,
    },
    "*",
  );
}

function postReplayBatchStatus(payload: {
  status: "started" | "completed" | "cancelled" | "failed";
  runId: number;
  error?: string | null;
}) {
  window.parent.postMessage(
    {
      message: "event-sequence-replay-batch-status",
      name: urlName,
      scenarioId,
      ...payload,
    },
    "*",
  );
}

/**
 * `postMessage` schedules the parent, but this frame keeps running synchronously into `replaySequenceStep`,
 * so `step-completed` can fire before React paints `step-started`. Yield so the creator strip can show
 * the active replay-only dot for each step.
 */
function yieldForHostReplayUi(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}
const trackedUserListeners = new WeakMap<EventTarget, Map<string, Set<EventListenerOrEventListenerObject>>>();
/** Baseline from the last full parent message; options-patch does not resend HTML/CSS/JS. */
let lastAppliedHtml = "";
let lastAppliedCss = "";
let lastAppliedJs = "";
const originalAddEventListener = EventTarget.prototype.addEventListener;
const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

function shouldTrackUserListenerRegistration(): boolean {
  if (!currentScriptUrl) {
    return false;
  }
  const stack = new Error().stack;
  return typeof stack === "string" && stack.includes(currentScriptUrl);
}

function trackUserListener(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null) {
  if (!listener) {
    return;
  }
  const byType = trackedUserListeners.get(target) ?? new Map<string, Set<EventListenerOrEventListenerObject>>();
  const listeners = byType.get(type) ?? new Set<EventListenerOrEventListenerObject>();
  listeners.add(listener);
  byType.set(type, listeners);
  trackedUserListeners.set(target, byType);
}

function untrackUserListener(target: EventTarget, type: string, listener: EventListenerOrEventListenerObject | null) {
  if (!listener) {
    return;
  }
  const byType = trackedUserListeners.get(target);
  const listeners = byType?.get(type);
  if (!listeners) {
    return;
  }
  listeners.delete(listener);
  if (listeners.size === 0) {
    byType?.delete(type);
  }
  if (byType && byType.size === 0) {
    trackedUserListeners.delete(target);
  }
}

function clearTrackedUserListeners() {
  trackedUserListeners.delete(window);
  trackedUserListeners.delete(document);
  trackedUserListeners.delete(document.body);
  trackedUserListeners.delete(document.documentElement);
}

EventTarget.prototype.addEventListener = function patchedAddEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | AddEventListenerOptions,
) {
  if (shouldTrackUserListenerRegistration()) {
    trackUserListener(this, type, listener);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

EventTarget.prototype.removeEventListener = function patchedRemoveEventListener(
  type: string,
  listener: EventListenerOrEventListenerObject | null,
  options?: boolean | EventListenerOptions,
) {
  untrackUserListener(this, type, listener);
  return originalRemoveEventListener.call(this, type, listener, options);
};

function updateInteractiveFlag() {
  document.body.dataset.interactive = interactive ? "true" : "false";
  document.body.dataset.recordingSequence = recordingSequence ? "true" : "false";
}

function clearRenderReadyTimeout() {
  if (renderReadyTimeoutId !== null) {
    window.clearTimeout(renderReadyTimeoutId);
    renderReadyTimeoutId = null;
  }
}

function clearPlaywrightLayoutFollowUp() {
  if (playwrightLayoutFollowUpId !== null) {
    window.clearTimeout(playwrightLayoutFollowUpId);
    playwrightLayoutFollowUpId = null;
  }
}

function clearPendingInteractionVerification() {
  if (interactionVerificationTimeoutId !== null) {
    window.clearTimeout(interactionVerificationTimeoutId);
    interactionVerificationTimeoutId = null;
  }
}

function postMountedPing() {
  window.parent.postMessage({ message: "mounted", name: urlName, scenarioId }, "*");
}

function startMountedPing() {
  if (mountedIntervalId !== null) {
    return;
  }
  postMountedPing();
  mountedIntervalId = window.setInterval(() => {
    postMountedPing();
  }, 200);
}

function stopMountedPing() {
  if (mountedIntervalId !== null) {
    window.clearInterval(mountedIntervalId);
    mountedIntervalId = null;
  }
}

function normalizeReplaySequence(raw: unknown): EventSequenceStep[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is EventSequenceStep => (
    Boolean(entry)
    && typeof entry === "object"
    && typeof (entry as EventSequenceStep).id === "string"
    && typeof (entry as EventSequenceStep).eventType === "string"
  ));
}

function getReplaySequenceSignature() {
  return replaySequence.map((step) => step.id).join("|");
}

function clearUserScript() {
  if (currentScript) {
    currentScript.remove();
    currentScript = null;
  }
  if (currentScriptUrl) {
    URL.revokeObjectURL(currentScriptUrl);
    currentScriptUrl = null;
  }
  clearTrackedUserListeners();
}

function hideError() {
  if (errorOverlay) {
    errorOverlay.remove();
    errorOverlay = null;
  }
  window.parent.postMessage(
    { message: "js-error-cleared", name: urlName, scenarioId },
    "*",
  );
}

function showError(error: ErrorObj) {
  if (!errorOverlay) {
    errorOverlay = document.createElement("div");
    errorOverlay.setAttribute("role", "alert");
    errorOverlay.dataset.drawboardUi = "true";
    Object.assign(errorOverlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "column",
      backgroundColor: "rgba(255, 0, 0, 0.5)",
      color: "white",
      zIndex: "9999",
    });
    document.body.appendChild(errorOverlay);
  }

  errorOverlay.innerHTML = "";

  const title = document.createElement("h2");
  title.textContent = "Oops! Something went wrong :(";
  Object.assign(title.style, {
    color: "white",
    fontSize: "1.5rem",
    fontWeight: "bold",
    marginBottom: "1rem",
  });

  const message = document.createElement("pre");
  message.textContent = error.message;
  Object.assign(message.style, {
    color: "white",
    fontSize: "1rem",
    whiteSpace: "pre-wrap",
    textAlign: "center",
    fontWeight: "bold",
  });

  errorOverlay.appendChild(title);
  errorOverlay.appendChild(message);

  if (error.lineno && error.colno) {
    const location = document.createElement("pre");
    location.textContent = `Line number: ${error.lineno}, column number: ${error.colno}`;
    errorOverlay.appendChild(location);
  }

  window.parent.postMessage(
    {
      message: "js-error",
      name: urlName,
      scenarioId,
      error: {
        message: error.message,
        lineno: error.lineno || 0,
        colno: error.colno || 0,
      },
    },
    "*",
  );
}

async function waitForPaintAfterCss() {
  const settleFonts = async () => {
    if (!document.fonts?.ready) {
      return;
    }
    try {
      if (isBrowserCapture) {
        await Promise.race([
          document.fonts.ready,
          new Promise<void>((resolve) => setTimeout(resolve, 32)),
        ]);
      } else {
        await document.fonts.ready;
      }
    } catch {
      /* ignore */
    }
  };

  await settleFonts();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  if (!isBrowserCapture) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await settleFonts();
    await new Promise<void>((resolve) => setTimeout(resolve, 56));
  }
}

function getReplayValueFromSnapshot(step: EventSequenceStep): { value?: string; checked?: boolean } {
  if (!step.selector) {
    return {};
  }
  try {
    const parsed = new DOMParser().parseFromString(step.snapshot.snapshotHtml, "text/html");
    const snapshotTarget = parsed.querySelector(step.selector);
    if (snapshotTarget instanceof HTMLInputElement) {
      return { value: snapshotTarget.value, checked: snapshotTarget.checked };
    }
    if (snapshotTarget instanceof HTMLTextAreaElement || snapshotTarget instanceof HTMLSelectElement) {
      return { value: snapshotTarget.value };
    }
  } catch (error) {
    console.error("Drawboard: Failed to derive replay value from snapshot", error);
  }
  return {};
}

async function replaySequenceStep(step: EventSequenceStep): Promise<boolean> {
  if (!step.selector) {
    return true;
  }
  let beforeHashForLog = "";

  const waitForReplayTarget = async (selector: string, timeoutMs: number): Promise<Element | null> => {
    const immediate = document.querySelector(selector);
    if (immediate instanceof Element) {
      return immediate;
    }

    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      let done = false;
      let frameId: number | null = null;
      let timeoutId: number | null = null;
      let observer: MutationObserver | null = null;

      const finish = (value: Element | null) => {
        if (done) {
          return;
        }
        done = true;
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        observer?.disconnect();
        resolve(value);
      };

      const check = () => {
        const match = document.querySelector(selector);
        if (match instanceof Element) {
          finish(match);
          return true;
        }
        return false;
      };

      const scheduleNextFrame = () => {
        frameId = window.requestAnimationFrame(() => {
          frameId = null;
          if (check()) {
            return;
          }
          if (Date.now() >= deadline) {
            finish(null);
            return;
          }
          scheduleNextFrame();
        });
      };

      if (typeof MutationObserver !== "undefined") {
        observer = new MutationObserver(() => {
          check();
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      timeoutId = window.setTimeout(() => finish(null), timeoutMs);
      scheduleNextFrame();
    });
  };

  const target = await waitForReplayTarget(step.selector, REPLAY_SELECTOR_WAIT_MS);
  if (!(target instanceof Element)) {
    postReplayStatus({
      status: "step-skipped",
      signature: getReplaySequenceSignature(),
      stepId: step.id,
      selector: step.selector ?? null,
      reason: "target-not-found",
      index: step.order,
      totalSteps: replaySequence.length,
    });
    console.warn("[drawboard:replay] querySelector missed", step.selector, "for step", step.id);
    return false;
  }

  try {
    const beforeSnapshot = createDrawboardSnapshot();
    const beforeHash = hashDrawboardSnapshot(beforeSnapshot.css, beforeSnapshot.snapshotHtml);
    beforeHashForLog = beforeHash;
    const dispatchMode =
      step.eventType === "click"
        ? "dispatch-click"
        : step.eventType === "submit"
          ? "request-submit"
          : step.eventType === "keydown"
            ? "dispatch-keydown"
            : "set-value-dispatch";
 
    if (step.eventType === "click") {
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    } else if (step.eventType === "submit") {
      const form = target instanceof HTMLFormElement ? target : target.closest("form");
      if (form instanceof HTMLFormElement) {
        form.requestSubmit();
      } else {
        target.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }
    } else if (step.eventType === "keydown") {
      const key = step.keyFilter || "Enter";
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    } else if (step.eventType === "input" || step.eventType === "change") {
      const { value, checked } = getReplayValueFromSnapshot(step);
      if (target instanceof HTMLInputElement) {
        if (typeof checked === "boolean") {
          target.checked = checked;
        }
        if (typeof value === "string") {
          target.value = value;
        }
      } else if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        if (typeof value === "string") {
          target.value = value;
        }
      }
      target.dispatchEvent(new Event(step.eventType, { bubbles: true, cancelable: true }));
    }
  } catch (error) {
    console.warn("[drawboard:replay] user code threw during event dispatch for step", step.id, error);
    // Re-throw so replaySequenceIfNeeded can reset the DOM baseline.
    throw error;
  }

  await waitForPaintAfterCss();
  const afterSnapshot = createDrawboardSnapshot();
  const afterHash = hashDrawboardSnapshot(afterSnapshot.css, afterSnapshot.snapshotHtml);
  const expectedPostHash = step.postHash.split(":")[0];

  return true;
}

async function replaySequenceIfNeeded() {
  const requestedSignature = getReplaySequenceSignature();
  if (!interactive || recordingSequence || !requestedSignature || replayAppliedSignature === requestedSignature) {
    return;
  }

  if (replayPromise) {
    await replayPromise;
    const latestSignature = getReplaySequenceSignature();
    if (interactive && !recordingSequence && latestSignature && replayAppliedSignature !== latestSignature) {
      await replaySequenceIfNeeded();
    }
    return;
  }

  const runPromise = (async () => {
    while (true) {
      const signature = getReplaySequenceSignature();
      if (!interactive || recordingSequence || !signature || replayAppliedSignature === signature) {
        return;
      }

      replayInFlight = true;
      try {
        postReplayStatus({
          status: "run-started",
          signature,
          totalSteps: replaySequence.length,
        });
        // If the body is empty and steps reference selectors, the baseline HTML/JS
        // hasn't provided the expected elements yet (e.g. level data still loading).
        // Skip this run so we don't mark the replay as applied on an empty DOM.
        const stepsNeedElements = replaySequence.some((step) => Boolean(step.selector));
        if (stepsNeedElements && !document.body.innerHTML.trim()) {
          return;
        }
        for (const [index, step] of replaySequence.entries()) {
          postReplayStatus({
            status: "step-started",
            signature,
            stepId: step.id,
            selector: step.selector ?? null,
            index,
            totalSteps: replaySequence.length,
          });
          await yieldForHostReplayUi();
          const completed = await replaySequenceStep(step);
          if (completed) {
            postReplayStatus({
              status: "step-completed",
              signature,
              stepId: step.id,
              selector: step.selector ?? null,
              index,
              totalSteps: replaySequence.length,
            });
          }
        }
        acceptedVisualState = await buildVisualState();
        replayAppliedSignature = signature;
        postReplayStatus({
          status: "run-completed",
          signature,
          totalSteps: replaySequence.length,
        });
      } catch (error) {
        postReplayStatus({
          status: "run-completed",
          signature,
          totalSteps: replaySequence.length,
        });
        console.error("Drawboard: replay sequence failed", error);
        // Reset DOM to a clean state so subsequent replays start fresh
        // instead of operating on a half-applied / corrupted DOM.
        try {
          applyHtml(lastAppliedHtml);
          syncEventListeners();
          installObservers();
          applyCss(lastAppliedCss);
          applyJs(lastAppliedJs);
        } catch (resetError) {
          console.error("Drawboard: baseline reset after failed replay also failed", resetError);
        }
        replayAppliedSignature = "";
        return;
      } finally {
        replayInFlight = false;
      }
    }
  })();

  replayPromise = runPromise;
  try {
    await runPromise;
  } finally {
    if (replayPromise === runPromise) {
      replayPromise = null;
    }
  }
}

async function captureCurrentPixelSignature() {
  const w = scenarioWidth || Math.max(document.documentElement.clientWidth, 1);
  const h = scenarioHeight || Math.max(document.documentElement.clientHeight, 1);
  const dataUrl = await domToPng(document.documentElement, {
    width: w,
    height: h,
    scale: 1,
    maximumCanvasSize: 4096,
  });
  const img = await loadImage(dataUrl);
  const imageData = getPixelData(img, w, h);
  if (!imageData) {
    return null;
  }
  return computePixelSignature(imageData);
}

async function buildVisualState(): Promise<VisualState> {
  const snapshot = createDrawboardSnapshot();
  return {
    snapshotHash: hashDrawboardSnapshot(snapshot.css, snapshot.snapshotHtml),
    pixelHash: await captureCurrentPixelSignature(),
  };
}

async function captureBrowser() {
  if (!stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }
  const w = scenarioWidth || 300;
  const h = scenarioHeight || 300;
  try {
    await waitForPaintAfterCss();
    await replaySequenceIfNeeded();
    const dataUrl = await domToPng(document.documentElement, {
      width: w,
      height: h,
      scale: 2,
      maximumCanvasSize: 8192,
    });
    const img = await loadImage(dataUrl);
    const imageData = getPixelData(img, w, h);
    if (!imageData) {
      return;
    }
    const bytes = new Uint8Array(imageData.data.length);
    bytes.set(imageData.data);

    window.parent.postMessage(
      {
        message: "pixels",
        dataURL: bytes.buffer,
        urlName,
        scenarioId,
        width: w,
        height: h,
        replaySignature: replayAppliedSignature,
      },
      "*",
      [bytes.buffer],
    );
    if (urlName === "solutionUrl" || urlName === "drawingUrl") {
      window.parent.postMessage({ dataURL: dataUrl, urlName, scenarioId, message: "data" }, "*");
    }
  } catch (error) {
    console.error("Drawboard: browser capture failed", error);
  }
}

async function captureReplayBatchCheckpoint(stepId: string, runId: number) {
  await waitForPaintAfterCss();
  if (isBrowserCapture) {
    const width = scenarioWidth || 300;
    const height = scenarioHeight || 300;
    const dataUrl = await domToPng(document.documentElement, {
      width,
      height,
      scale: 2,
      maximumCanvasSize: 8192,
    });
    const image = await loadImage(dataUrl);
    const imageData = getPixelData(image, width, height);
    if (!imageData) {
      return;
    }
    const pixels = new Uint8Array(imageData.data.length);
    pixels.set(imageData.data);
    window.parent.postMessage(
      {
        message: "event-sequence-replay-batch-checkpoint",
        name: urlName,
        scenarioId,
        runId,
        stepId,
        replaySignature: getReplaySequenceSignature(),
        width,
        height,
        dataUrl,
        pixels: pixels.buffer,
      },
      "*",
      [pixels.buffer],
    );
    return;
  }

  const snapshot = createDrawboardSnapshot();
  window.parent.postMessage(
    {
      ...snapshot,
      message: "event-sequence-replay-batch-checkpoint",
      name: urlName,
      scenarioId,
      runId,
      stepId,
      replaySignature: getReplaySequenceSignature(),
      width: scenarioWidth || Math.max(document.documentElement.clientWidth, 1),
      height: scenarioHeight || Math.max(document.documentElement.clientHeight, 1),
    },
    "*",
  );
}

function restoreReplayBaseline() {
  clearRenderReadyTimeout();
  clearPlaywrightLayoutFollowUp();
  applyHtml(lastAppliedHtml);
  syncEventListeners();
  installObservers();
  applyCss(lastAppliedCss);
  applyJs(lastAppliedJs);
}

function maybeStartPendingReplayBatch() {
  if (!pendingReplayBatchRequest) {
    return;
  }
  if (recordingSequence || !stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }
  const nextRequest = pendingReplayBatchRequest;
  pendingReplayBatchRequest = null;
  void runReplayBatch(nextRequest.runId, nextRequest.steps, nextRequest.visibleStepIds);
}

async function runReplayBatch(runId: number, steps: EventSequenceStep[], visibleStepIds: string[]) {
  if (recordingSequence || !stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }
  if (replayBatchRunId === runId) {
    return;
  }

  replayBatchRunId = runId;
  replayBatchCancelledRunId = null;
  replayInFlight = true;
  postReplayBatchStatus({ runId, status: "started" });
  postReplayStatus({
    status: "run-started",
    signature: getReplaySequenceSignature(),
    totalSteps: steps.length,
  });

  try {
    restoreReplayBaseline();
    await waitForPaintAfterCss();
    if (replayBatchCancelledRunId === runId) {
      postReplayBatchStatus({ runId, status: "cancelled" });
      return;
    }

    const visibleStepSet = new Set(visibleStepIds);
    const initialVisibleStepId = visibleStepIds[0] ?? null;
    if (initialVisibleStepId) {
      await captureReplayBatchCheckpoint(initialVisibleStepId, runId);
    }

    for (const [index, step] of steps.entries()) {
      if (replayBatchCancelledRunId === runId) {
        postReplayBatchStatus({ runId, status: "cancelled" });
        return;
      }
      postReplayStatus({
        status: "step-started",
        signature: getReplaySequenceSignature(),
        stepId: step.id,
        selector: step.selector ?? null,
        index,
        totalSteps: steps.length,
      });
      await yieldForHostReplayUi();
      const completed = await replaySequenceStep(step);
      if (completed) {
        postReplayStatus({
          status: "step-completed",
          signature: getReplaySequenceSignature(),
          stepId: step.id,
          selector: step.selector ?? null,
          index,
          totalSteps: steps.length,
        });
        if (visibleStepSet.has(step.id)) {
          await captureReplayBatchCheckpoint(step.id, runId);
        }
      }
    }

    acceptedVisualState = await buildVisualState();
    replayAppliedSignature = getReplaySequenceSignature();
    postReplayStatus({
      status: "run-completed",
      signature: getReplaySequenceSignature(),
      totalSteps: steps.length,
    });
    postReplayBatchStatus({ runId, status: "completed" });
  } catch (error) {
    console.error("Drawboard: replay batch failed", error);
    try {
      restoreReplayBaseline();
    } catch (resetError) {
      console.error("Drawboard: baseline reset after failed replay batch also failed", resetError);
    }
    replayAppliedSignature = "";
    postReplayBatchStatus({
      runId,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown replay batch failure",
    });
  } finally {
    replayInFlight = false;
    if (replayBatchRunId === runId) {
      replayBatchRunId = null;
    }
  }
}

function runCaptureNow() {
  void (async () => {
    try {
      if (isBrowserCapture) {
        await waitForPaintAfterCss();
        await replaySequenceIfNeeded();
        await captureBrowser();
        return;
      }
      await waitForPaintAfterCss();
      await replaySequenceIfNeeded();
      const snapshot = createDrawboardSnapshot();
      window.parent.postMessage(
        { ...snapshot, message: "capture-request", name: urlName, scenarioId },
        "*",
      );
    } catch (snapshotError) {
      console.error("Drawboard: Failed to create snapshot", snapshotError);
    }
  })();
}

function installObservers() {
  mutationObserver?.disconnect();
  resizeObserver?.disconnect();

  if (typeof MutationObserver !== "undefined") {
    mutationObserver = new MutationObserver((records) => {
      if (
        records.some((record) =>
          record.type === "childList"
          || record.type === "characterData"
          || (record.type === "attributes" && record.attributeName !== "data-interactive"),
        )
      ) {
        domMutationVersion += 1;
      }
    });
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  }

  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      layoutMutationVersion += 1;
    });
    resizeObserver.observe(document.body);
    resizeObserver.observe(document.documentElement);
  }
}

function clearObservers() {
  mutationObserver?.disconnect();
  mutationObserver = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
}

function triggerMatchesEvent(trigger: InteractionTrigger, event: Event): boolean {
  if (trigger.eventType !== event.type) {
    return false;
  }

  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }

  if (trigger.selector) {
    const match = target.closest(trigger.selector);
    if (!match || !document.body.contains(match)) {
      return false;
    }
  }

  if (trigger.eventType === "keydown" && trigger.keyFilter) {
    const keyPressed = (event as KeyboardEvent).key?.trim().toLowerCase();
    return keyPressed === trigger.keyFilter.trim().toLowerCase();
  }

  return true;
}

function buildCandidateTrigger(event: Event): InteractionTrigger | null {
  const eventType = event.type as InteractionTrigger["eventType"];
  const listenerTarget = findTrackedUserListenerTarget(event);
  const replayTarget = listenerTarget ?? event.target;
  const selector = selectorFromEventTarget(replayTarget);
  const targetSummary = summarizeEventTarget(replayTarget);
  const copy = buildDraftEventStepCopy(eventType, targetSummary);
  return {
    id: `recorded-${eventType}-${Date.now()}`,
    eventType,
    selector,
    keyFilter: event instanceof KeyboardEvent ? event.key : undefined,
    label: copy.label,
  };
}

function findTrackedUserListenerTarget(event: Event): EventTarget | null {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  const candidates = path.length > 0
    ? path
    : [event.target, document.body, document, window].filter(Boolean);

  for (const candidate of candidates) {
    if (!(candidate instanceof EventTarget)) {
      continue;
    }
    const listeners = trackedUserListeners.get(candidate)?.get(event.type);
    if (listeners && listeners.size > 0) {
      return candidate;
    }
  }

  return null;
}

function isSubmitControlElement(target: EventTarget | null): target is HTMLButtonElement | HTMLInputElement {
  if (target instanceof HTMLButtonElement) {
    return (target.type || "submit").toLowerCase() === "submit";
  }
  if (target instanceof HTMLInputElement) {
    const type = (target.type || "").toLowerCase();
    return type === "submit" || type === "image";
  }
  return false;
}

function shouldSkipHiddenSubmitterClick(event: Event, showInTimeline: boolean): boolean {
  if (showInTimeline || event.type !== "click") {
    return false;
  }
  const target = event.target;
  if (!isSubmitControlElement(target)) {
    return false;
  }
  const form = target.form ?? target.closest("form");
  if (!(form instanceof HTMLFormElement)) {
    return false;
  }
  const submitListeners = trackedUserListeners.get(form)?.get("submit");
  return Boolean(submitListeners && submitListeners.size > 0);
}

async function verifyTriggeredInteraction(candidate: TriggerCandidate) {
  if (!stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }

  const baseline = acceptedVisualState ?? (() => {
    const currentSnapshot = createDrawboardSnapshot();
    return {
      snapshotHash: hashDrawboardSnapshot(currentSnapshot.css, currentSnapshot.snapshotHtml),
      pixelHash: null,
    };
  })();
  if (!acceptedVisualState) {
    acceptedVisualState = baseline;
  }

  const startDomMutationVersion = domMutationVersion;
  const startLayoutMutationVersion = layoutMutationVersion;

  if (recordingSequence) {
    await new Promise<void>((resolve) => setTimeout(resolve, 48));
  } else {
    await waitForPaintAfterCss();
    await new Promise<void>((resolve) => setTimeout(resolve, 24));
  }

  const snapshot = createDrawboardSnapshot();
  const postHash = hashDrawboardSnapshot(snapshot.css, snapshot.snapshotHtml);
  let verificationSource: VerifiedInteraction["verificationSource"] | null = null;
  let pixelHash: string | null = baseline.pixelHash;

  if (postHash !== baseline.snapshotHash) {
    verificationSource = "dom";
  } else {
    const mutated = domMutationVersion !== startDomMutationVersion || layoutMutationVersion !== startLayoutMutationVersion;
    if (!mutated) {
      return;
    }
    pixelHash = await captureCurrentPixelSignature();
    if (pixelHash && pixelHash !== baseline.pixelHash) {
      verificationSource = "pixel";
    }
  }

  if (!verificationSource) {
    const allowNoOpSubmit =
      candidate.trigger.eventType === "submit"
      && Boolean(candidate.trigger.selector);
    if (!allowNoOpSubmit) {
      return;
    }
    verificationSource = "dom";
  }

  interactionSequence += 1;
  const interaction: VerifiedInteraction = {
    id: `${candidate.trigger.id}:${interactionSequence}:${baseline.snapshotHash}:${postHash}`,
    triggerId: candidate.trigger.id,
    eventType: candidate.trigger.eventType,
    label: candidate.trigger.label,
    selector: candidate.trigger.selector,
    targetSummary: candidate.targetSummary,
    keyFilter: candidate.trigger.keyFilter,
    keyPressed: candidate.keyPressed,
    sequence: interactionSequence,
    createdAt: new Date().toISOString(),
    preHash: baseline.snapshotHash,
    postHash: verificationSource === "pixel" && pixelHash ? `${postHash}:${pixelHash}` : postHash,
    verificationSource,
  };

  acceptedVisualState = {
    snapshotHash: postHash,
    pixelHash: pixelHash ?? baseline.pixelHash,
  };

  if (recordingSequence) {
    const copy = buildDraftEventStepCopy(candidate.trigger.eventType, candidate.targetSummary);
    const step: EventSequenceStep = {
      id: `step-${scenarioId}-${Date.now()}-${interactionSequence}`,
      scenarioId,
      order: interactionSequence - 1,
      eventType: candidate.trigger.eventType,
      showInTimeline: candidate.showInTimeline !== false,
      selector: candidate.trigger.selector,
      keyFilter: candidate.trigger.keyFilter,
      instruction: copy.instruction,
      targetSummary: candidate.targetSummary,
      verificationSource,
      preHash: interaction.preHash,
      postHash: interaction.postHash,
      snapshot: createSnapshotPayload(scenarioWidth || Math.max(document.documentElement.clientWidth, 1), scenarioHeight || Math.max(document.documentElement.clientHeight, 1)),
    };

    window.parent.postMessage(
      {
        message: "recorded-event-sequence-step",
        urlName,
        scenarioId,
        step,
      },
      "*",
    );
    return;
  }

  window.parent.postMessage(
    {
      message: "verified-interaction",
      urlName,
      scenarioId,
      interaction,
    },
    "*",
  );
}

function scheduleInteractionVerification(candidate: TriggerCandidate) {
  if ((!interactive && !recordingSequence) || errorOverlay) {
    return;
  }
  pendingCandidate = candidate;
  clearPendingInteractionVerification();
  interactionVerificationTimeoutId = window.setTimeout(() => {
    interactionVerificationTimeoutId = null;
    const nextCandidate = pendingCandidate;
    pendingCandidate = null;
    if (!nextCandidate || interactionVerificationInFlight) {
      return;
    }
    interactionVerificationInFlight = true;
    void verifyTriggeredInteraction(nextCandidate)
      .catch((error) => {
        console.error("Drawboard: interaction verification failed", error);
      })
      .finally(() => {
        interactionVerificationInFlight = false;
      });
  }, INTERACTION_SETTLE_DELAY_MS);
}

function handleTriggeredEvent(event: Event) {
  if ((!interactive && !recordingSequence) || errorOverlay || replayInFlight) {
    return;
  }

  const matchedTrigger = recordingSequence
    ? buildCandidateTrigger(event)
    : triggers.find((trigger) => triggerMatchesEvent(trigger, event));
  if (!matchedTrigger) {
    return;
  }

  const recordingListenerTarget = recordingSequence ? findTrackedUserListenerTarget(event) : null;
  const showInTimeline = recordingSequence ? Boolean(recordingListenerTarget) : undefined;
  if (recordingSequence && shouldSkipHiddenSubmitterClick(event, showInTimeline === true)) {
    return;
  }
  const candidateTarget = recordingSequence ? (recordingListenerTarget ?? event.target) : event.target;

  scheduleInteractionVerification({
    trigger: matchedTrigger,
    targetSummary: summarizeEventTarget(candidateTarget),
    keyPressed: event instanceof KeyboardEvent ? event.key : undefined,
    showInTimeline,
  });
}

function syncEventListeners() {
  const eventTypes = recordingSequence
    ? new Set<InteractionTrigger["eventType"]>(["click", "change", "input", "submit", "keydown"])
    : new Set(triggers.map((trigger) => trigger.eventType));
  (["click", "change", "input", "submit", "keydown"] as const).forEach((eventType) => {
    document.body.removeEventListener(eventType, handleTriggeredEvent, true);
    if (eventTypes.has(eventType)) {
      document.body.addEventListener(eventType, handleTriggeredEvent, true);
    }
  });
}

function handleUnsafeSubmitNavigation(event: Event) {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) {
    return;
  }

  // Bubble-phase listener runs after element/form listeners, before browser navigation.
  if (event.defaultPrevented) {
    return;
  }
  event.preventDefault();
  window.parent.postMessage(
    {
      message: "unhandled-form-submit-detected",
      name: urlName,
      scenarioId,
      action: form.getAttribute("action") || "",
    },
    "*",
  );
}

async function refreshAcceptedVisualState() {
  if (!stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }
  try {
    await waitForPaintAfterCss();
    acceptedVisualState = await buildVisualState();
  } catch (error) {
    console.error("Drawboard: failed to refresh accepted visual state", error);
  }
}

function scheduleRenderReady() {
  clearRenderReadyTimeout();
  clearPlaywrightLayoutFollowUp();
  if (!stylesCorrect || !jsCorrect || errorOverlay) {
    return;
  }

  maybeStartPendingReplayBatch();

  const delayMs = isBrowserCapture ? 0 : PLAYWRIGHT_RENDER_READY_DELAY_MS;

  renderReadyTimeoutId = window.setTimeout(() => {
    void (async () => {
      if (isManualCapture && !manualModeBootstrapCapturePending) {
        await refreshAcceptedVisualState();
        return;
      }

      if (isBrowserCapture) {
        try {
          await waitForPaintAfterCss();
          await replaySequenceIfNeeded();
          await captureBrowser();
          await refreshAcceptedVisualState();
          if (isManualCapture) {
            manualModeBootstrapCapturePending = false;
          }
        } catch (browserCaptureError) {
          console.error("Drawboard: Browser capture failed", browserCaptureError);
        }
        return;
      }

      try {
        await waitForPaintAfterCss();
        await replaySequenceIfNeeded();
        const snapshot = createDrawboardSnapshot();
        acceptedVisualState = {
          snapshotHash: hashDrawboardSnapshot(snapshot.css, snapshot.snapshotHtml),
          pixelHash: await captureCurrentPixelSignature(),
        };
        window.parent.postMessage(
          { ...snapshot, message: "render-ready", name: urlName, scenarioId },
          "*",
        );
        if (isManualCapture) {
          manualModeBootstrapCapturePending = false;
        }
      } catch (playwrightSnapshotError) {
        console.error("Drawboard: Failed to create snapshot", playwrightSnapshotError);
      }

      if (!isManualCapture) {
        clearPlaywrightLayoutFollowUp();
        playwrightLayoutFollowUpId = window.setTimeout(() => {
          playwrightLayoutFollowUpId = null;
          if (!stylesCorrect || !jsCorrect || errorOverlay) {
            return;
          }
          void (async () => {
            try {
              await waitForPaintAfterCss();
              await replaySequenceIfNeeded();
              const followSnapshot = createDrawboardSnapshot();
              acceptedVisualState = {
                snapshotHash: hashDrawboardSnapshot(followSnapshot.css, followSnapshot.snapshotHtml),
                pixelHash: await captureCurrentPixelSignature(),
              };
              window.parent.postMessage(
                { ...followSnapshot, message: "render-ready", name: urlName, scenarioId },
                "*",
              );
            } catch (snapshotError) {
              console.error("Drawboard: Failed layout follow-up snapshot", snapshotError);
            }
          })();
        }, PLAYWRIGHT_LAYOUT_FOLLOW_UP_MS);
      }
    })();
  }, delayMs);
}

function applyHtml(html: string) {
  // Clear stale errorOverlay reference — innerHTML wipe detaches it from the
  // DOM but the variable still blocks event listeners, replay, and render-ready.
  errorOverlay = null;
  document.body.innerHTML = html;
  applyScenarioDocumentBox();
}

function applyCss(css: string) {
  try {
    setStyles(css);
    stylesCorrect = true;
  } catch {
    stylesCorrect = false;
  }
}

function applyJs(js: string) {
  clearUserScript();

  if (!js.trim()) {
    jsCorrect = true;
    scheduleRenderReady();
    return;
  }

  jsCorrect = false;
  const blob = new Blob([`{ ${js} \n }`], { type: "text/javascript" });
  const scriptUrl = URL.createObjectURL(blob);
  const script = document.createElement("script");
  script.dataset.user = "true";
  script.src = scriptUrl;
  script.onload = () => {
    jsCorrect = true;
    scheduleRenderReady();
  };
  script.onerror = () => {
    showError({ message: "Failed to execute scenario JavaScript" });
  };

  currentScript = script;
  currentScriptUrl = scriptUrl;
  document.body.appendChild(script);
}

function resetState() {
  clearRenderReadyTimeout();
  clearPlaywrightLayoutFollowUp();
  clearPendingInteractionVerification();
  clearUserScript();
  hideError();
  document.body.innerHTML = "";
  setStyles("");
  applyScenarioDocumentBox();
  stylesCorrect = false;
  jsCorrect = false;
  interactive = false;
  triggers = [];
  recordingSequence = false;
  replaySequence = [];
  replayInFlight = false;
  replayAppliedSignature = "";
  selectedReplayStepId = null;
  dataReceived = false;
  pendingCandidate = null;
  acceptedVisualState = null;
  interactionSequence = 0;
  domMutationVersion = 0;
  layoutMutationVersion = 0;
  updateInteractiveFlag();
  syncEventListeners();
  clearObservers();
  installObservers();
  startMountedPing();
}

window.onerror = (message, _source, lineno, colno) => {
  showError({
    message: message.toString(),
    lineno: lineno || 0,
    colno: colno || 0,
  });
  return true;
};

installObservers();
document.addEventListener("submit", handleUnsafeSubmitNavigation, false);

window.addEventListener("message", (event: MessageEvent<DrawboardPayload>) => {
  if (urlName !== event.data?.name) {
    return;
  }

  if (event.data?.message === "reload") {
    resetState();
    return;
  }

  if (event.data?.message === "options-patch") {
    if (event.data.scenarioId !== undefined && event.data.scenarioId !== scenarioId) {
      return;
    }
    const incomingReplay = normalizeReplaySequence(event.data?.replaySequence);
    const prevReplaySignature = getReplaySequenceSignature();
    const nextReplaySignature = incomingReplay.map((step) => step.id).join("|");
    const replaySignatureChanged = prevReplaySignature !== nextReplaySignature;
    const prevSelectedReplayStepId = selectedReplayStepId;
    const prevInteractive = interactive;
    const prevRecording = recordingSequence;

    interactive = Boolean(event.data.interactive);
    recordingSequence = Boolean(event.data.recordingSequence);
    selectedReplayStepId = typeof event.data?.selectedReplayStepId === "string"
      ? event.data.selectedReplayStepId
      : null;
    triggers = normalizeInteractionTriggers(event.data?.events);
    replaySequence = incomingReplay;

    /**
     * Clearing replayAppliedSignature on every patch forced replay to run again even when the
     * replay prefix was unchanged (e.g. React re-sending the same patch). That re-dispatched
     * events on an already-mutated DOM (double replay). Only reset when replay or mode changed.
     */
    const interactiveChanged = prevInteractive !== interactive;
    const recordingChanged = prevRecording !== recordingSequence;
    const selectedReplayStepChanged = prevSelectedReplayStepId !== selectedReplayStepId;
    if (replaySignatureChanged || interactiveChanged || recordingChanged) {
      replayAppliedSignature = "";
    }

    updateInteractiveFlag();
    syncEventListeners();

    /**
     * Full iframe reload is debounced on html/css/js only; step scrub sends options-patch.
     * Without resetting the document, replay runs on DOM still mutated by the previous prefix
     * (wrong baseline). Re-apply the last baseline, then scheduleRenderReady/replay as usual.
     * Also reset when interactive toggles with a non-empty replay (otherwise replay runs twice
     * on a mutated tree).
     *
     * Recording mutates the live DOM while replaySequence often stays [] (no prefix until scrub).
     * When recording stops with an empty replay, signature does not change — re-apply baseline
     * so the iframe matches template HTML again (e.g. #status back to initial Closed).
     */
    const recordingEnded = recordingChanged && prevRecording && !recordingSequence;
    const resetToInitialStep = selectedReplayStepChanged && selectedReplayStepId === (replaySequence[0]?.id ?? null);
    const needsBaselineReset =
      replaySignatureChanged
      || (interactiveChanged && incomingReplay.length > 0)
      || (recordingEnded && incomingReplay.length === 0)
      || resetToInitialStep;
    if (needsBaselineReset && dataReceived) {
      clearRenderReadyTimeout();
      clearPlaywrightLayoutFollowUp();
      applyHtml(lastAppliedHtml);
      syncEventListeners();
      installObservers();
      applyCss(lastAppliedCss);
      applyJs(lastAppliedJs);
      return;
    }
    if (needsBaselineReset && !dataReceived) {
      console.warn("[drawboard:options-patch] replay changed but no data received yet — patch will be applied on next full payload");
    }

    if (stylesCorrect && jsCorrect && !errorOverlay) {
      maybeStartPendingReplayBatch();
      scheduleRenderReady();
    }
    return;
  }

  if (event.data?.message === "request-capture") {
    if (event.data.scenarioId !== undefined && event.data.scenarioId !== scenarioId) {
      return;
    }
    runCaptureNow();
    return;
  }

  if (event.data?.message === "cancel-replay-batch") {
    if (event.data.scenarioId !== undefined && event.data.scenarioId !== scenarioId) {
      return;
    }
    if (typeof event.data?.runId === "number") {
      replayBatchCancelledRunId = event.data.runId;
      if (pendingReplayBatchRequest?.runId === event.data.runId) {
        pendingReplayBatchRequest = null;
        postReplayBatchStatus({ runId: event.data.runId, status: "cancelled" });
      }
    }
    return;
  }

  if (event.data?.message === "request-replay-batch") {
    if (event.data.scenarioId !== undefined && event.data.scenarioId !== scenarioId) {
      return;
    }
    if (typeof event.data?.runId !== "number") {
      return;
    }
    const batchReplaySequence = normalizeReplaySequence(event.data?.replaySequence);
    const visibleStepIds = Array.isArray(event.data?.visibleStepIds)
      ? event.data.visibleStepIds.filter((entry): entry is string => typeof entry === "string")
      : [];
    pendingReplayBatchRequest = {
      runId: event.data.runId,
      steps: batchReplaySequence,
      visibleStepIds,
    };
    maybeStartPendingReplayBatch();
    return;
  }

  dataReceived = true;
  stopMountedPing();
  hideError();

  const nextHtml = event.data?.html || "";
  const nextCss = event.data?.css || "";
  const nextJs = event.data?.js || "";
  lastAppliedHtml = nextHtml;
  lastAppliedCss = nextCss;
  lastAppliedJs = nextJs;
  interactive = Boolean(event.data?.interactive);
  recordingSequence = Boolean(event.data?.recordingSequence);
  triggers = normalizeInteractionTriggers(event.data?.events);
  replaySequence = normalizeReplaySequence(event.data?.replaySequence);
  replayAppliedSignature = "";
  updateInteractiveFlag();

  applyHtml(nextHtml);
  syncEventListeners();
  installObservers();
  applyCss(nextCss);
  applyJs(nextJs);
  maybeStartPendingReplayBatch();
});

if (!dataReceived) {
  startMountedPing();
}
