import type { EventSequenceStep } from "@/types";
import {
  getStepAccuracyEntryFromCapture,
  selectCaptureState,
  useEventSequenceCaptureStore,
  type EventSequenceCaptureSlice,
} from "./eventSequenceCaptureStore";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "./eventSequenceReplayTypes";

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

function scenarioStepKeys(steps: EventSequenceStep[]): string[] {
  const timelineSteps = steps.filter((s) => s.showInTimeline !== false);
  return [INITIAL_EVENT_SEQUENCE_STEP_ID, ...timelineSteps.map((s) => s.id)];
}

export function aggregateScenarioAccuracyFromCapture(
  steps: EventSequenceStep[],
  capture: EventSequenceCaptureSlice,
): ScenarioAccuracyAggregate {
  const keys = scenarioStepKeys(steps);
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
  steps: EventSequenceStep[],
  runtimeKey: string | null | undefined,
): ScenarioAccuracyAggregate {
  if (!runtimeKey) return EMPTY_SCENARIO_ACCURACY_AGGREGATE;
  const capture = selectCaptureState(useEventSequenceCaptureStore.getState().captureByKey, runtimeKey);
  return aggregateScenarioAccuracyFromCapture(steps, capture);
}
