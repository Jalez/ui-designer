/**
 * useSequenceRuntimeLifecycle — Manages the sequence runtime state lifecycle:
 * key resets, drawing version bumps, recording mode,
 * and verified interaction handling.
 */
import { useCallback, useEffect, useRef } from "react";
import { resetRuntimeForKey } from "@/events/core/sequenceLifecycle";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceAccuracyStore";
import { useEventSequenceGameProgressStore } from "@/events/core/eventSequenceGameProgressStore";
import { useEventSequenceRecordingStore } from "@/events/core/eventSequenceRecordingStore";
import type { VerifiedInteraction, EventSequenceStep } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseSequenceRuntimeLifecycleParams = {
  currentLevel: number;
  level: { interactive?: boolean } | undefined;
  isCreator: boolean;
  runtimeKey: string;
  scenarioSequence: EventSequenceStep[];
  sequenceRuntime: { activeIndex: number; recordingMode: string };
  compareSourcesFingerprint: string;
  suppressHeavyLayoutEffects: boolean;
  gameplayActiveSequenceStep: EventSequenceStep | null;
};

export type UseSequenceRuntimeLifecycleResult = {
  handleVerifiedInteraction: (interaction: VerifiedInteraction) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSequenceRuntimeLifecycle({
  currentLevel,
  level,
  isCreator,
  runtimeKey,
  scenarioSequence,
  sequenceRuntime,
  compareSourcesFingerprint,
  suppressHeavyLayoutEffects,
  gameplayActiveSequenceStep,
}: UseSequenceRuntimeLifecycleParams): UseSequenceRuntimeLifecycleResult {

  const previousRuntimeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = previousRuntimeKeyRef.current;
    previousRuntimeKeyRef.current = runtimeKey;
    if (prev !== null && prev !== runtimeKey) resetRuntimeForKey(prev);
  }, [runtimeKey]);

  // ---- Drawing version bump on source change ----

  const prevFingerprintRuntimeKeyRef = useRef<string | null>(null);
  const prevCompareSourcesFingerprintRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (scenarioSequence.length === 0 || suppressHeavyLayoutEffects) return;
    if (prevFingerprintRuntimeKeyRef.current !== runtimeKey) {
      prevFingerprintRuntimeKeyRef.current = runtimeKey;
      prevCompareSourcesFingerprintRef.current = undefined;
    }
    const fp = compareSourcesFingerprint;
    const prevFp = prevCompareSourcesFingerprintRef.current;
    if (prevFp !== undefined && prevFp !== fp) {
      useEventSequenceCaptureStore.getState().bumpDrawingVersion(runtimeKey);
    }
    prevCompareSourcesFingerprintRef.current = fp;
  }, [compareSourcesFingerprint, runtimeKey, scenarioSequence.length, suppressHeavyLayoutEffects]);

  // ---- Single recording auto-stop ----

  const visibleSequenceLength = scenarioSequence.filter((step) => step.showInTimeline !== false).length;
  const previousVisibleSequenceLengthRef = useRef(visibleSequenceLength);
  useEffect(() => {
    if (
      isCreator
      && previousVisibleSequenceLengthRef.current < visibleSequenceLength
      && sequenceRuntime.recordingMode === "single"
    ) {
      useEventSequenceRecordingStore.getState().setRecordingMode(runtimeKey, "idle");
    }
    previousVisibleSequenceLengthRef.current = visibleSequenceLength;
  }, [isCreator, runtimeKey, sequenceRuntime.recordingMode, visibleSequenceLength]);

  // ---- Verified interaction handler ----

  const handleVerifiedInteraction = useCallback((interaction: VerifiedInteraction) => {
    if (isCreator || !gameplayActiveSequenceStep) return;
    if (interaction.triggerId !== gameplayActiveSequenceStep.id) return;
    useEventSequenceGameProgressStore.getState().setPendingStep(runtimeKey, gameplayActiveSequenceStep.id);
  }, [gameplayActiveSequenceStep, isCreator, runtimeKey]);

  return { handleVerifiedInteraction };
}
