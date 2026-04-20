import type { EventSequenceStep } from "@/types";
import { getStepAccuracyValue, isStepStale } from "./eventSequenceCaptureStore";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "./eventSequenceReplayTypes";

/**
 * Mean accuracy for footer/points when using the event-sequence timeline:
 * average of measured accuracies for initial + each step.
 * Returns null unless every step has a fresh (non-stale) measured value ≥ 0.
 */
export function aggregateEventSequenceAccuracy(
  steps: EventSequenceStep[],
  runtimeKey: string,
): number | null {
  const timelineSteps = steps.filter((s) => s.showInTimeline !== false);
  const keys = [INITIAL_EVENT_SEQUENCE_STEP_ID, ...timelineSteps.map((s) => s.id)];
  for (const k of keys) {
    const v = getStepAccuracyValue(runtimeKey, k);
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return null;
    }
    if (isStepStale(runtimeKey, k)) {
      return null;
    }
  }
  const raw = keys.reduce((sum, k) => sum + (getStepAccuracyValue(runtimeKey, k) as number), 0) / keys.length;
  return Math.round(raw * 100) / 100;
}
