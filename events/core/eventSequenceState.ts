"use client";

/**
 * Event-sequence client state: re-exports domain stores, merged runtime view,
 * capture/run helpers, and replay lifecycle facades.
 * Prefer importing `useEventSequence*Store` for the concern you need.
 */

import {
  getStepAccuracyEntryFromCapture,
  getStepAccuracyValueFromCapture,
  isStepStaleInCapture,
  useEventSequenceCaptureStore,
} from "./eventSequenceAccuracyStore";
import { getMergedSequenceRuntimeState } from "./eventSequenceMergedRuntime";
import type { StepAccuracyState } from "./eventSequenceMetricsTypes";
import type {
  SequenceRuntimeState,
} from "./eventSequenceReplayTypes";

export type { StepAccuracyState } from "./eventSequenceMetricsTypes";

export type {
  AutoReplayRequest,
  AutoReplayState,
  EventSequenceRecordingMode,
  ReplayBatchSessionState,
  ReplayDiagnosticsState,
  ReplayJourneyState,
  ReplayStepDiagnostic,
  ReplayStepDiagnosticStatus,
  SequenceRuntimeState,
} from "./eventSequenceReplayTypes";

export {
  EMPTY_SEQUENCE_RUNTIME_STATE,
  getEventSequenceScenarioUiKey,
} from "./eventSequenceReplayTypes";

export { useEventSequenceRecordingStore } from "./eventSequenceRecordingStore";
export { useEventSequenceGameProgressStore } from "./eventSequenceGameProgressStore";
export { useEventSequenceTimelineUiStore } from "./eventSequenceTimelineUiStore";
export { useEventSequenceAutoRunPrefsStore } from "./eventSequenceAutoRunPrefsStore";
export { useEventSequenceReplayBatchStore } from "./eventSequenceReplayBatchStore";
export { useEventSequenceReplayUiStore } from "./eventSequenceReplayUiStore";
export { useEventSequenceCaptureStore } from "./eventSequenceAccuracyStore";
export { useEventSequenceRunStore } from "./eventSequenceRunStore";

export {
  beginReplayBatch,
  endReplayBatch,
  markReplayJourneyCompleted,
  markStepAccuracyTimedOut,
  resetRuntimeForKey,
  resetRuntimeState,
  startAutoReplay,
} from "./eventSequenceFacades";

export { getMergedSequenceRuntimeState, useMergedSequenceRuntimeState } from "./eventSequenceMergedRuntime";

/**
 * Merged runtime slice for one `runtimeKey`.
 * @param _runtimeByKey Ignored; state now lives in split stores.
 */
export function selectRuntimeState(
  _runtimeByKey: Record<string, SequenceRuntimeState>,
  key: string | null | undefined,
): SequenceRuntimeState {
  return getMergedSequenceRuntimeState(key ?? null);
}

export function getRuntimeState(key: string): SequenceRuntimeState {
  return getMergedSequenceRuntimeState(key);
}

export function getStepAccuracyEntry(
  runtimeKey: string,
  stepId: string | null | undefined,
): StepAccuracyState | null {
  return getStepAccuracyEntryFromCapture(
    useEventSequenceCaptureStore.getState().getCaptureState(runtimeKey),
    stepId,
  );
}

export function getStepAccuracyValue(
  runtimeKey: string,
  stepId: string | null | undefined,
): number | null {
  return getStepAccuracyValueFromCapture(
    useEventSequenceCaptureStore.getState().getCaptureState(runtimeKey),
    stepId,
  );
}

function waitForRuntimeStepAccuracy(
  runtimeKey: string,
  stepId: string,
  timeoutMs: number,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let settled = false;

    const finish = (resolver: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      unsub();
      resolver();
    };

    const check = () => {
      const value = getStepAccuracyValue(runtimeKey, stepId);
      if (typeof value === "number" && value !== -1) {
        finish(() => resolve(value));
      }
    };

    const unsub = useEventSequenceCaptureStore.subscribe(check);
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Timeout waiting for event ${stepId} accuracy`)));
    }, timeoutMs);

    check();
  });
}

export function waitForStepAccuracy(
  runtimeKey: string,
  stepId: string,
  timeoutMs = 10_000,
): Promise<number> {
  return waitForRuntimeStepAccuracy(runtimeKey, stepId, timeoutMs);
}

export function isStepStale(runtimeKey: string, stepId: string): boolean {
  return isStepStaleInCapture(useEventSequenceCaptureStore.getState().getCaptureState(runtimeKey), stepId);
}
