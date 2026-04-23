/**
 * Latest drawing/solution ImageData per scenario from drawboard iframe "pixels" messages.
 * Mirrors LevelUpdater state so consumers (e.g. event-sequence step accuracy) can run the
 * same comparison as ScenarioUpdater without prop drilling.
 */

type PixelPair = {
  drawing: ImageData | null;
  solution: ImageData | null;
};

type ReplaySignatures = {
  drawing: string | null;
  solution: string | null;
};

export type SessionStepDrawingCapture = {
  capturedAt: number;
  dataUrl: string;
  height: number;
  imageData: ImageData;
  replaySignature: string | null;
  runId: number;
  stepId: string;
  width: number;
};

const pairsByScenario = new Map<string, PixelPair>();
const serialByScenario = new Map<string, number>();
const sideSerialsByScenario = new Map<string, { drawing: number; solution: number }>();
const replaySignaturesByScenario = new Map<string, ReplaySignatures>();
const listenersByScenario = new Map<string, Set<() => void>>();
const stepDrawingCapturesByCacheKey = new Map<string, Map<string, SessionStepDrawingCapture>>();
const stepDrawingCaptureListenersByCacheKey = new Map<string, Set<() => void>>();

export function subscribeDrawboardPixelsForScenario(
  scenarioId: string,
  listener: () => void,
): () => void {
  let set = listenersByScenario.get(scenarioId);
  if (!set) {
    set = new Set();
    listenersByScenario.set(scenarioId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      listenersByScenario.delete(scenarioId);
    }
  };
}

export function notifyDrawboardPixels(
  scenarioId: string,
  side: "drawing" | "solution",
  data: ImageData,
  replaySignature?: string | null,
): void {
  let pair = pairsByScenario.get(scenarioId);
  if (!pair) {
    pair = { drawing: null, solution: null };
  }
  if (side === "drawing") {
    pair.drawing = data;
  } else {
    pair.solution = data;
  }
  pairsByScenario.set(scenarioId, pair);
  serialByScenario.set(scenarioId, (serialByScenario.get(scenarioId) ?? 0) + 1);
  const sideSerials = sideSerialsByScenario.get(scenarioId) ?? { drawing: 0, solution: 0 };
  sideSerialsByScenario.set(scenarioId, {
    ...sideSerials,
    [side]: sideSerials[side] + 1,
  });
  const signatures = replaySignaturesByScenario.get(scenarioId) ?? { drawing: null, solution: null };
  replaySignaturesByScenario.set(scenarioId, {
    ...signatures,
    [side]: replaySignature ?? null,
  });
  listenersByScenario.get(scenarioId)?.forEach((l) => l());
}

export function getDrawboardPixelsPair(scenarioId: string): PixelPair {
  return pairsByScenario.get(scenarioId) ?? { drawing: null, solution: null };
}

export function getDrawboardPixelsSerial(scenarioId: string): number {
  return serialByScenario.get(scenarioId) ?? 0;
}

export function getDrawboardPixelsSideSerials(scenarioId: string): { drawing: number; solution: number } {
  return sideSerialsByScenario.get(scenarioId) ?? { drawing: 0, solution: 0 };
}

export function getDrawboardReplaySignatures(scenarioId: string): ReplaySignatures {
  return replaySignaturesByScenario.get(scenarioId) ?? { drawing: null, solution: null };
}

/** Drop solution-side buffers after the live solution iframe is unmounted (e.g. game route). */
export function clearStoredSolutionSide(scenarioId: string): void {
  const pair = pairsByScenario.get(scenarioId);
  if (!pair || !pair.solution) {
    return;
  }
  pair.solution = null;
  pairsByScenario.set(scenarioId, pair);
  serialByScenario.set(scenarioId, (serialByScenario.get(scenarioId) ?? 0) + 1);
  const sideSerials = sideSerialsByScenario.get(scenarioId) ?? { drawing: 0, solution: 0 };
  sideSerialsByScenario.set(scenarioId, {
    ...sideSerials,
    solution: sideSerials.solution + 1,
  });
  const signatures = replaySignaturesByScenario.get(scenarioId) ?? { drawing: null, solution: null };
  replaySignaturesByScenario.set(scenarioId, {
    ...signatures,
    solution: null,
  });
  listenersByScenario.get(scenarioId)?.forEach((l) => l());
}

export function clearDrawboardPixelsForScenario(scenarioId: string): void {
  const hadPair = pairsByScenario.has(scenarioId);
  const hadSerial = serialByScenario.has(scenarioId);
  const hadSideSerials = sideSerialsByScenario.has(scenarioId);
  const hadSignatures = replaySignaturesByScenario.has(scenarioId);
  const hadAccuracy = accuracyResultsByScenario.has(scenarioId);

  pairsByScenario.delete(scenarioId);
  serialByScenario.delete(scenarioId);
  sideSerialsByScenario.delete(scenarioId);
  replaySignaturesByScenario.delete(scenarioId);
  accuracyResultsByScenario.delete(scenarioId);

  if (hadPair || hadSerial || hadSideSerials || hadSignatures || hadAccuracy) {
    listenersByScenario.get(scenarioId)?.forEach((l) => l());
    accuracyListenersByScenario.get(scenarioId)?.forEach((l) => l());
  }
}

export function clearDrawboardPixelsStore(): void {
  pairsByScenario.clear();
  serialByScenario.clear();
  sideSerialsByScenario.clear();
  replaySignaturesByScenario.clear();
  listenersByScenario.clear();
  stepDrawingCapturesByCacheKey.clear();
  stepDrawingCaptureListenersByCacheKey.clear();
  accuracyResultsByScenario.clear();
  accuracyListenersByScenario.clear();
}

export function subscribeSessionStepDrawingCaptures(
  cacheKey: string,
  listener: () => void,
): () => void {
  let set = stepDrawingCaptureListenersByCacheKey.get(cacheKey);
  if (!set) {
    set = new Set();
    stepDrawingCaptureListenersByCacheKey.set(cacheKey, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      stepDrawingCaptureListenersByCacheKey.delete(cacheKey);
    }
  };
}

export function notifySessionStepDrawingCapture(
  cacheKey: string,
  capture: SessionStepDrawingCapture,
): void {
  const captures = stepDrawingCapturesByCacheKey.get(cacheKey) ?? new Map<string, SessionStepDrawingCapture>();
  captures.set(capture.stepId, capture);
  stepDrawingCapturesByCacheKey.set(cacheKey, captures);
  stepDrawingCaptureListenersByCacheKey.get(cacheKey)?.forEach((listener) => listener());
}

export function getSessionStepDrawingCapture(
  cacheKey: string,
  stepId: string,
): SessionStepDrawingCapture | null {
  return stepDrawingCapturesByCacheKey.get(cacheKey)?.get(stepId) ?? null;
}

export function clearSessionStepDrawingCaptures(cacheKey: string): void {
  if (!stepDrawingCapturesByCacheKey.has(cacheKey)) {
    return;
  }
  stepDrawingCapturesByCacheKey.delete(cacheKey);
  stepDrawingCaptureListenersByCacheKey.get(cacheKey)?.forEach((listener) => listener());
}

// ---------------------------------------------------------------------------
// Step accuracy results — published by ScenarioUpdater after each comparison
// ---------------------------------------------------------------------------

export type StepAccuracyResult = {
  stepId: string | null;
  accuracy: number;
  serial: number;
  /** Side serials captured at comparison time (browser-mode gate check). */
  sideSerials: { drawing: number; solution: number };
};

const accuracyResultsByScenario = new Map<string, StepAccuracyResult>();
const accuracyListenersByScenario = new Map<string, Set<() => void>>();

export function notifyStepAccuracyResult(
  scenarioId: string,
  stepId: string | null,
  accuracy: number,
  sideSerials: { drawing: number; solution: number },
): void {
  const prev = accuracyResultsByScenario.get(scenarioId);
  accuracyResultsByScenario.set(scenarioId, {
    stepId,
    accuracy,
    serial: (prev?.serial ?? 0) + 1,
    sideSerials,
  });
  accuracyListenersByScenario.get(scenarioId)?.forEach((l) => l());
}

export function getLatestStepAccuracyResult(scenarioId: string): StepAccuracyResult | null {
  return accuracyResultsByScenario.get(scenarioId) ?? null;
}

export function subscribeStepAccuracyForScenario(
  scenarioId: string,
  listener: () => void,
): () => void {
  let set = accuracyListenersByScenario.get(scenarioId);
  if (!set) {
    set = new Set();
    accuracyListenersByScenario.set(scenarioId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) {
      accuracyListenersByScenario.delete(scenarioId);
    }
  };
}
