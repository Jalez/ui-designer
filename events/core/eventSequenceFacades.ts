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

export function resetRuntimeState(key: string): void {
  if (useEventSequenceReplayBatchStore.getState().getReplayBatchSession(key)) {
    useEventSequenceRunStore.getState().setEventSequenceRunning(false);
  }
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
