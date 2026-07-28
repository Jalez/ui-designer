/**
 * Atomic-ish multi-store updates for event-sequence replay lifecycle.
 * Each underlying store still owns its slice; facades only sequence writes.
 */
import { getStepAccuracyValueFromCapture, useEventSequenceCaptureStore } from "./eventSequenceAccuracyStore";
import { useEventSequenceGameProgressStore } from "./eventSequenceGameProgressStore";
import { useEventSequenceRecordingStore } from "./eventSequenceRecordingStore";
import { useEventSequenceReplayBatchStore } from "./eventSequenceReplayBatchStore";
import { useEventSequenceReplayUiStore } from "./eventSequenceReplayUiStore";
import { useEventSequenceRunStore } from "./eventSequenceRunStore";
import { useSequenceReplayStore } from "./sequenceReplayStore";

export function beginReplayBatch(
  key: string,
  totalSteps: number,
  originalSelectedStepId: string | null,
): void {
  const runId = Date.now();
  useSequenceReplayStore.getState().startBatch(key, runId, totalSteps, originalSelectedStepId);
  useEventSequenceReplayBatchStore.getState().setReplayBatchSession(key, {
    runId,
    originalSelectedStepId,
    stepIndex: 0,
    totalSteps,
  });
  useEventSequenceReplayUiStore.getState().startReplayJourneyForBatch(key, totalSteps);
  useEventSequenceRunStore.getState().setEventSequenceRunning(true);
}

/** @deprecated Use `beginReplayBatch` */
export function startAutoReplay(
  key: string,
  totalSteps: number,
  originalSelectedStepId: string | null,
): void {
  beginReplayBatch(key, totalSteps, originalSelectedStepId);
}

export function endReplayBatch(key: string): void {
  useSequenceReplayStore.getState().endBatch(key);
  useEventSequenceReplayBatchStore.getState().clearReplayBatchForKey(key);
  useEventSequenceReplayUiStore.getState().endReplayJourneyFromBatch(key);
  useEventSequenceRunStore.getState().setEventSequenceRunning(false);
}

export function markReplayJourneyCompleted(key: string, totalSteps: number): void {
  useEventSequenceCaptureStore.getState().recordReplayJourneyCompletedBaseline(key);
  useSequenceReplayStore.getState().markJourneyCompleted(key, totalSteps);
  useEventSequenceReplayUiStore.getState().markReplayJourneyCompletedSlice(key, totalSteps);
}

/**
 * Single teardown for one `runtimeKey` across every replay store. `endReplayBatch` is the only
 * other place that clears `isRunning`, and it early-returns once the batch is gone, so a reset
 * that dropped the batch without clearing `isRunning` left scoring stuck off (see #14).
 */
export function resetRuntimeState(key: string): void {
  const hadBatch = Boolean(useSequenceReplayStore.getState().getBatch(key))
    || Boolean(useEventSequenceReplayBatchStore.getState().getReplayBatchSession(key));
  if (hadBatch) {
    useEventSequenceRunStore.getState().setEventSequenceRunning(false);
  }
  useSequenceReplayStore.getState().clearForKey(key);
  useEventSequenceCaptureStore.getState().clearCaptureStateForRuntimeKey(key);
  useEventSequenceRecordingStore.getState().clearRecordingModeForKey(key);
  useEventSequenceGameProgressStore.getState().clearGameProgressForKey(key);
  useEventSequenceReplayBatchStore.getState().clearReplayBatchForKey(key);
  useEventSequenceReplayUiStore.getState().clearReplayUiForKey(key);
}

export function resetRuntimeForKey(key: string): void {
  resetRuntimeState(key);
}

export function markStepAccuracyTimedOut(key: string, stepId: string): void {
  const capture = useEventSequenceCaptureStore.getState().getCaptureState(key);
  if (getStepAccuracyValueFromCapture(capture, stepId) !== -1) {
    return;
  }
  useEventSequenceCaptureStore.getState().markStepAccuracyTimedOut(key, stepId);
  useEventSequenceGameProgressStore.getState().clearPendingIfMatches(key, stepId);
}
