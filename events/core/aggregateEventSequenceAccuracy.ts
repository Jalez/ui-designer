import type { EventSequenceStep } from "@/types";
import {
  getStepAccuracyEntryFromCapture,
  selectCaptureState,
  useEventSequenceCaptureStore,
  type EventSequenceCaptureSlice,
} from "./eventSequenceAccuracyStore";

export type ScenarioAccuracyAggregate = {
  accuracy: number;
  meanKnown: boolean;
  stale: boolean;
};

export const EMPTY_SCENARIO_ACCURACY_AGGREGATE: ScenarioAccuracyAggregate = {
  accuracy: 0,
  meanKnown: false,
  stale: false,
};

function scenarioStepKeys(scenarioId: string, steps: EventSequenceStep[]): string[] {
  return steps
    .filter((step) => step.showInTimeline !== false)
    .map((step) => step.id);
}

export function aggregateScenarioAccuracyFromCapture(
  scenarioId: string,
  steps: EventSequenceStep[],
  capture: EventSequenceCaptureSlice,
): ScenarioAccuracyAggregate {
  const keys = scenarioStepKeys(scenarioId, steps);
  let sum = 0;
  let stale = false;
  for (const key of keys) {
    const entry = getStepAccuracyEntryFromCapture(capture, key);
    const value = entry?.accuracy;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return { accuracy: 0, meanKnown: false, stale: false };
    }
    if (entry && entry.version < capture.drawingVersion) stale = true;
    sum += value;
  }
  const accuracy = Math.round((sum / keys.length) * 100) / 100;
  return { accuracy, meanKnown: true, stale };
}

export function aggregateEventSequenceAccuracy(
  scenarioId: string,
  steps: EventSequenceStep[],
  runtimeKey: string | null | undefined,
): ScenarioAccuracyAggregate {
  if (!runtimeKey) return EMPTY_SCENARIO_ACCURACY_AGGREGATE;
  const capture = selectCaptureState(useEventSequenceCaptureStore.getState().captureByKey, runtimeKey);
  return aggregateScenarioAccuracyFromCapture(scenarioId, steps, capture);
}
