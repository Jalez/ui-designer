"use client";

import {
  getStepAccuracyValue,
  useEventSequenceCaptureStore,
} from "./eventSequenceAccuracyStore";
import { useEventSequenceGameProgressStore } from "./eventSequenceGameProgressStore";
import { useEventSequenceRecordingStore } from "./eventSequenceRecordingStore";
import { useSequenceReplayStore } from "./sequenceReplayStore";

/** Clear every per-runtime-key slice across stores (used on teardown / scenario swap). */
export function resetRuntimeForKey(key: string): void {
  useSequenceReplayStore.getState().clearForKey(key);
  useEventSequenceCaptureStore.getState().clearCaptureStateForRuntimeKey(key);
  useEventSequenceRecordingStore.getState().clearRecordingModeForKey(key);
  useEventSequenceGameProgressStore.getState().clearGameProgressForKey(key);
}

/** Mark a pending accuracy measurement as timed-out and release the game pending gate. */
export function markStepAccuracyTimedOut(key: string, stepId: string): void {
  if (getStepAccuracyValue(key, stepId) !== -1) return;
  useEventSequenceCaptureStore.getState().markStepAccuracyTimedOut(key, stepId);
  useEventSequenceGameProgressStore.getState().clearPendingIfMatches(key, stepId);
}
