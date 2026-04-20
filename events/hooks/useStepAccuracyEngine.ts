/**
 * useStepAccuracyEngine — Orchestration layer for event-sequence step accuracy.
 *
 * Subscribes to pixel-comparison results published by ScenarioUpdater,
 * manages per-step loading sentinels and replay pixel gates, handles gameplay
 * advancement, and pushes the aggregated footer score.
 *
 * Pixel comparison itself is fully delegated to ScenarioUpdater.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { updateLevelAccuracyByIndexThunk } from "@/store/actions/score.actions";
import {
  getStepAccuracyValue,
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "@/events/core/eventSequenceCaptureStore";
import { useEventSequenceGameProgressStore } from "@/events/core/eventSequenceGameProgressStore";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { markStepAccuracyTimedOut } from "@/events/core/sequenceLifecycle";
import { aggregateEventSequenceAccuracy } from "@/events/core/aggregateEventSequenceAccuracy";
import { resolveFocusedGameStepId } from "@/events/core/eventsRuntimeDerived";
import {
  getDrawboardPixelsSideSerials,
  getLatestStepAccuracyResult,
  subscribeStepAccuracyForScenario,
} from "@/lib/drawboard/drawboardPixelsStore";
import type { EventSequenceStep } from "@/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_COMPARE_TIMEOUT_MS = 5000;
const BROWSER_REPLAY_TIMEOUT_PER_STEP_MS = 1500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseStepAccuracyEngineParams = {
  scenarioId: string;
  scenarioSequence: EventSequenceStep[];
  runtimeKey: string;
  isCreator: boolean;
  selectedEventSequenceStepId?: string | null;
  replaySequence: EventSequenceStep[];
  gameplayActiveSequenceStep: EventSequenceStep | null;
  drawboardCaptureMode: string;
  suppressSequenceMetrics: boolean;
  currentLevel: number;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStepAccuracyEngine({
  scenarioId,
  scenarioSequence,
  runtimeKey,
  isCreator,
  selectedEventSequenceStepId,
  replaySequence,
  gameplayActiveSequenceStep,
  drawboardCaptureMode,
  suppressSequenceMetrics,
  currentLevel,
}: UseStepAccuracyEngineParams): void {
  const dispatch = useAppDispatch();
  const activeIndex = useEventSequenceGameProgressStore(
    (state) => state.activeIndexByKey[runtimeKey] ?? 0,
  );
  const sequenceCapture = useEventSequenceCaptureStore((state) => (
    selectCaptureState(state.captureByKey, runtimeKey)
  ));
  const prevCompareStepSelectionRef = useRef<string | null>(null);
  const prevCompareRuntimeKeyRef = useRef<string | null>(null);
  const prevReplaySignatureRef = useRef<string>("");
  const compareTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const replayPixelGateRef = useRef<{
    stepId: string;
    minDrawingSerial: number;
    minSolutionSerial: number;
  } | null>(null);
  const lastFooterSyncSigRef = useRef<string | null>(null);
  const compareTimeoutMs =
    drawboardCaptureMode === "browser" && replaySequence.length > 0
      ? Math.max(BASE_COMPARE_TIMEOUT_MS, replaySequence.length * BROWSER_REPLAY_TIMEOUT_PER_STEP_MS)
      : BASE_COMPARE_TIMEOUT_MS;

  // ---- Compare timeout management ----

  const clearCompareTimeout = useCallback((stepId: string | null | undefined) => {
    if (!stepId) return;
    const existing = compareTimeoutsRef.current[stepId];
    if (existing) { clearTimeout(existing); delete compareTimeoutsRef.current[stepId]; }
  }, []);

  const armCompareTimeout = useCallback((stepId: string) => {
    clearCompareTimeout(stepId);
    compareTimeoutsRef.current[stepId] = setTimeout(() => {
      markStepAccuracyTimedOut(runtimeKey, stepId);
      delete compareTimeoutsRef.current[stepId];
    }, compareTimeoutMs);
  }, [compareTimeoutMs, clearCompareTimeout, runtimeKey]);

  // Cleanup on unmount
  useEffect(() => () => {
    Object.values(compareTimeoutsRef.current).forEach(clearTimeout);
    compareTimeoutsRef.current = {};
  }, []);

  // ---- Main orchestration effect ----

  useEffect(() => {
    if (suppressSequenceMetrics) return;

    if (prevCompareRuntimeKeyRef.current !== runtimeKey) {
      prevCompareRuntimeKeyRef.current = runtimeKey;
      prevCompareStepSelectionRef.current = null;
    }

    const focusedId = resolveFocusedGameStepId({
      isCreatorContext: isCreator,
      isSequencePanelOpen: isCreator,
      selectedSequenceStepId: selectedEventSequenceStepId?.trim() || null,
      scenarioSequence,
      activeIndex,
    }) ?? null;
    const replaySignature = replaySequence.map((s) => s.id).join("|");
    const prevFocusedId = prevCompareStepSelectionRef.current;

    // -- Loading sentinel: mark step as pending (-1) when focus changes --
    if (focusedId !== prevFocusedId) {
      clearCompareTimeout(prevFocusedId);
      prevCompareStepSelectionRef.current = focusedId;
      if (focusedId) {
        armCompareTimeout(focusedId);
        useEventSequenceCaptureStore.getState().markStepAccuracyPending(runtimeKey, focusedId);
      } else {
        replayPixelGateRef.current = null;
      }
    }
    if (focusedId && getStepAccuracyValue(runtimeKey, focusedId) === -1
      && !compareTimeoutsRef.current[focusedId]) {
      armCompareTimeout(focusedId);
    }

    // -- Replay pixel gate: arm when focused step or replay sequence changes --
    // Blocks accepting accuracy results from pixels that predate the replay.
    const shouldArmGate = Boolean(focusedId) && drawboardCaptureMode === "browser" && replaySequence.length > 0;
    const prevReplaySig = prevReplaySignatureRef.current;
    if (focusedId) {
      if (shouldArmGate && (focusedId !== prevFocusedId || replaySignature !== prevReplaySig)) {
        const sideSerials = getDrawboardPixelsSideSerials(runtimeKey);
        replayPixelGateRef.current = {
          stepId: focusedId,
          minDrawingSerial: sideSerials.drawing,
          minSolutionSerial: sideSerials.solution,
        };
      } else if (!shouldArmGate) {
        replayPixelGateRef.current = null;
      }
      prevReplaySignatureRef.current = replaySignature;
    } else {
      prevReplaySignatureRef.current = "";
    }

    if (!focusedId) return;

    let cancelled = false;

    // -- Handle an accuracy result from ScenarioUpdater --
    const handleResult = () => {
      if (cancelled) return;
      const result = getLatestStepAccuracyResult(runtimeKey);
      if (!result || result.stepId !== focusedId) return;

      // Replay gate: reject only when *both* sides still match pre-replay serials.
      // (Per-side strict > wrongly stalled when solution iframe posted before drawing serial bumped.)
      const gate = replayPixelGateRef.current;
      if (gate && gate.stepId === focusedId) {
        const bothStillStale =
          result.sideSerials.drawing <= gate.minDrawingSerial
          && result.sideSerials.solution <= gate.minSolutionSerial;
        if (bothStillStale) {
          return;
        }
        replayPixelGateRef.current = null;
      }

      clearCompareTimeout(focusedId);

      let mergedSnapshot: Record<string, number> = {};
      const capStore = useEventSequenceCaptureStore.getState();
      const prevCap = capStore.getCaptureState(runtimeKey);
      mergedSnapshot = Object.fromEntries(
        Object.entries(prevCap.stepAccuraciesByStepId).map(([stepId, value]) => [stepId, value.accuracy]),
      );
      mergedSnapshot[focusedId] = result.accuracy;
      capStore.updateCaptureState(runtimeKey, (c) => ({
        ...c,
        stepAccuraciesByStepId: {
          ...c.stepAccuraciesByStepId,
          [focusedId]: {
            accuracy: result.accuracy,
            version: c.drawingVersion,
          },
        },
      }));

      if (!isCreator) {
        const step = gameplayActiveSequenceStep;
        useEventSequenceGameProgressStore.getState().tryAdvanceAfterVerifiedAccuracy({
          key: runtimeKey,
          isRunning: useSequenceReplayStore.getState().isRunning,
          gameplayStepId: step?.id ?? null,
          pendingStepId: useEventSequenceGameProgressStore.getState().pendingStepIdByKey[runtimeKey] ?? null,
          accuracy: result.accuracy,
          scenarioSequenceLength: scenarioSequence.length,
        });
      }
    };

    // Run immediately (handles a result already in store) then subscribe for future results.
    handleResult();
    const unsub = subscribeStepAccuracyForScenario(runtimeKey, handleResult);
    return () => { cancelled = true; unsub(); };
  }, [
    armCompareTimeout,
    clearCompareTimeout,
    currentLevel,
    dispatch,
    drawboardCaptureMode,
    gameplayActiveSequenceStep,
    isCreator,
    replaySequence,
    runtimeKey,
    scenarioId,
    scenarioSequence,
    selectedEventSequenceStepId,
    suppressSequenceMetrics,
    activeIndex,
  ]);

  // Footer mean: sync whenever sequence runtime changes (step scores, staleness, drawing version).
  useEffect(() => {
    if (suppressSequenceMetrics) return;

    const syncFooter = () => {
      const agg = aggregateEventSequenceAccuracy(scenarioSequence, runtimeKey);
      const meanKnown = agg !== null;
      const accuracy = meanKnown ? agg : 0;
      const sig = `${meanKnown}:${accuracy}`;
      if (lastFooterSyncSigRef.current === sig) return;
      lastFooterSyncSigRef.current = sig;
      dispatch(
        updateLevelAccuracyByIndexThunk(currentLevel - 1, scenarioId, accuracy, meanKnown),
      );
    };

    lastFooterSyncSigRef.current = null;
    syncFooter();
  }, [
    currentLevel,
    dispatch,
    runtimeKey,
    scenarioId,
    scenarioSequence,
    sequenceCapture,
    activeIndex,
    suppressSequenceMetrics,
  ]);
}
