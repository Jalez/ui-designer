/**
 * useSequenceRuntimeLifecycle — Manages the sequence runtime state lifecycle:
 * key resets, drawing version bumps, recording mode,
 * Playwright bootstrap, and verified interaction handling.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { toggleImageInteractivity } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { useEventSequenceStore } from "@/events/core/eventSequenceState";
import type { scenario, VerifiedInteraction, EventSequenceStep } from "@/types";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** One bootstrap per level across all mounted clones (SidebySideArt mounts several instances). */
let playwrightGameInteractiveBootstrappedLevel: number | null = null;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseSequenceRuntimeLifecycleParams = {
  scenario: scenario;
  currentLevel: number;
  level: { interactive?: boolean } | undefined;
  isCreator: boolean;
  runtimeKey: string;
  scenarioSequence: EventSequenceStep[];
  sequenceRuntime: { activeIndex: number; recordingMode: string };
  drawboardCaptureMode: string;
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
  scenario,
  currentLevel,
  level,
  isCreator,
  runtimeKey,
  scenarioSequence,
  sequenceRuntime,
  drawboardCaptureMode,
  compareSourcesFingerprint,
  suppressHeavyLayoutEffects,
  gameplayActiveSequenceStep,
}: UseSequenceRuntimeLifecycleParams): UseSequenceRuntimeLifecycleResult {
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();

  // ---- Playwright bootstrap ----

  useEffect(() => {
    if (!level || isCreator || drawboardCaptureMode !== "playwright") return;
    if (playwrightGameInteractiveBootstrappedLevel === currentLevel) return;
    if (!level.interactive) {
      dispatch(toggleImageInteractivity(currentLevel));
      syncLevelFields(currentLevel - 1, ["interactive"]);
    }
    playwrightGameInteractiveBootstrappedLevel = currentLevel;
  }, [currentLevel, dispatch, drawboardCaptureMode, isCreator, level, syncLevelFields]);

  // ---- Runtime key lifecycle ----

  const previousRuntimeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = previousRuntimeKeyRef.current;
    previousRuntimeKeyRef.current = runtimeKey;
    if (prev !== null && prev !== runtimeKey) useEventSequenceStore.getState().resetRuntimeForKey(prev);
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
      useEventSequenceStore.getState().bumpDrawingVersion(runtimeKey);
    }
    prevCompareSourcesFingerprintRef.current = fp;
  }, [compareSourcesFingerprint, runtimeKey, scenarioSequence.length, suppressHeavyLayoutEffects]);

  // ---- Single recording auto-stop ----

  const previousSequenceLengthRef = useRef(scenarioSequence.length);
  useEffect(() => {
    if (isCreator && previousSequenceLengthRef.current < scenarioSequence.length && sequenceRuntime.recordingMode === "single") {
      useEventSequenceStore.getState().setRecordingMode(runtimeKey, "idle");
    }
    previousSequenceLengthRef.current = scenarioSequence.length;
  }, [isCreator, runtimeKey, scenarioSequence.length, sequenceRuntime.recordingMode]);

  // ---- Verified interaction handler ----

  const handleVerifiedInteraction = useCallback((interaction: VerifiedInteraction) => {
    if (isCreator || !gameplayActiveSequenceStep) return;
    if (interaction.triggerId !== gameplayActiveSequenceStep.id) return;
    useEventSequenceStore.getState().setPendingStep(runtimeKey, gameplayActiveSequenceStep.id);
  }, [gameplayActiveSequenceStep, isCreator, runtimeKey]);

  return { handleVerifiedInteraction };
}
