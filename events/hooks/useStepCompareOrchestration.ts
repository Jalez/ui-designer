/**
 * useStepCompareOrchestration — Pixel-compare orchestration for the focused
 * event-sequence step. Writes per-step accuracy into the capture store and
 * advances gameplay when a verified accuracy lands.
 *
 * Accuracy aggregation (scenario / level) lives in the context layer; this
 * hook only manages the step-level compare loop.
 */
import { useCallback, useEffect, useRef } from "react";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceCaptureStore";
import { useEventSequenceGameProgressStore } from "@/events/core/eventSequenceGameProgressStore";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { markStepAccuracyTimedOut } from "@/events/core/sequenceLifecycle";
import { resolveFocusedGameStepId } from "@/events/core/eventsRuntimeDerived";
import {
  getDrawboardPixelsSideSerials,
  getLatestStepAccuracyResult,
  subscribeStepAccuracyForScenario,
} from "@/lib/drawboard/drawboardPixelsStore";
import type { EventSequenceStep } from "@/types";

const BASE_COMPARE_TIMEOUT_MS = 5000;
const BROWSER_REPLAY_TIMEOUT_PER_STEP_MS = 1500;

export type UseStepCompareOrchestrationParams = {
  scenarioSequence: EventSequenceStep[];
  runtimeKey: string;
  isCreator: boolean;
  selectedEventSequenceStepId?: string | null;
  replaySequence: EventSequenceStep[];
  gameplayActiveSequenceStep: EventSequenceStep | null;
  drawboardCaptureMode: string;
  suppressSequenceMetrics: boolean;
};

export function useStepCompareOrchestration({
  scenarioSequence,
  runtimeKey,
  isCreator,
  selectedEventSequenceStepId,
  replaySequence,
  gameplayActiveSequenceStep,
  drawboardCaptureMode,
  suppressSequenceMetrics,
}: UseStepCompareOrchestrationParams): void {
  const activeIndex = useEventSequenceGameProgressStore(
    (state) => state.activeIndexByKey[runtimeKey] ?? 0,
  );
  const prevCompareStepSelectionRef = useRef<string | null>(null);
  const prevCompareRuntimeKeyRef = useRef<string | null>(null);
  const prevReplaySignatureRef = useRef<string>("");
  const compareTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const replayPixelGateRef = useRef<{
    stepId: string;
    minDrawingSerial: number;
    minSolutionSerial: number;
  } | null>(null);
  const compareTimeoutMs =
    drawboardCaptureMode === "browser" && replaySequence.length > 0
      ? Math.max(BASE_COMPARE_TIMEOUT_MS, replaySequence.length * BROWSER_REPLAY_TIMEOUT_PER_STEP_MS)
      : BASE_COMPARE_TIMEOUT_MS;

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

  useEffect(() => () => {
    Object.values(compareTimeoutsRef.current).forEach(clearTimeout);
    compareTimeoutsRef.current = {};
  }, []);

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
    if (focusedId) {
      const capture = useEventSequenceCaptureStore.getState().getCaptureState(runtimeKey);
      const value = capture.stepAccuraciesByStepId[focusedId]?.accuracy;
      if (value === -1 && !compareTimeoutsRef.current[focusedId]) {
        armCompareTimeout(focusedId);
      }
    }

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

    const handleResult = () => {
      if (cancelled) return;
      const result = getLatestStepAccuracyResult(runtimeKey);
      if (!result || result.stepId !== focusedId) return;

      const gate = replayPixelGateRef.current;
      if (gate && gate.stepId === focusedId) {
        const bothStillStale =
          result.sideSerials.drawing <= gate.minDrawingSerial
          && result.sideSerials.solution <= gate.minSolutionSerial;
        if (bothStillStale) return;
        replayPixelGateRef.current = null;
      }

      clearCompareTimeout(focusedId);

      useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, focusedId, result.accuracy);

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

    handleResult();
    const unsub = subscribeStepAccuracyForScenario(runtimeKey, handleResult);
    return () => { cancelled = true; unsub(); };
  }, [
    armCompareTimeout,
    clearCompareTimeout,
    drawboardCaptureMode,
    gameplayActiveSequenceStep,
    isCreator,
    replaySequence,
    runtimeKey,
    scenarioSequence,
    selectedEventSequenceStepId,
    suppressSequenceMetrics,
    activeIndex,
  ]);
}
