"use client";

import {
  getStepAccuracyValue,
  useEventSequenceCaptureStore,
} from "./eventSequenceAccuracyStore";
import { resetRuntimeState } from "./eventSequenceFacades";
import { useEventSequenceGameProgressStore } from "./eventSequenceGameProgressStore";

/**
 * Clear every per-runtime-key slice across stores (used on teardown / scenario swap).
 * Delegates to the facade so this path cannot drift from `eventSequenceFacades.resetRuntimeState`
 * and leave `isRunning` or the batch session behind.
 */
export function resetRuntimeForKey(key: string): void {
  resetRuntimeState(key);
}

/** Mark a pending accuracy measurement as timed-out and release the game pending gate. */
export function markStepAccuracyTimedOut(key: string, stepId: string): void {
  if (getStepAccuracyValue(key, stepId) !== -1) return;
  useEventSequenceCaptureStore.getState().markStepAccuracyTimedOut(key, stepId);
  useEventSequenceGameProgressStore.getState().clearPendingIfMatches(key, stepId);
}
