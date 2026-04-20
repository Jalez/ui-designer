"use client";

import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { type scenario } from "@/types";
import { addDifferenceUrl } from "@/store/slices/differenceUrls.slice";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { resolveEventSequenceDiffUrl } from "@/events/core/eventSequenceDiffUrls";
import { resolveEventSequenceSolutionUrl } from "@/events/core/eventSequenceSolutionUrls";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceCaptureStore";

type UseScenarioEventBridgeParams = {
  selectedScenario: scenario | null;
  currentEventStepId: string;
  selectedRuntimeKey: string | null;
};

export type ScenarioEventBridge = {
  current: {
    stepId: string;
    solutionUrl: string | null;
    diffUrl: string | null;
    solutionUrlStale: boolean;
    accuracyRaw: number | null;
  };
  handlers: {
    setCurrentEventSolutionUrl: (url: string, stepId?: string | null) => void;
    setCurrentEventDiffUrl: (url: string, stepId?: string | null) => void;
    setCurrentEventAccuracy: (accuracy: number, stepId?: string | null) => void;
  };
};

export function useScenarioEventBridge({
  selectedScenario,
  currentEventStepId,
  selectedRuntimeKey,
}: UseScenarioEventBridgeParams): ScenarioEventBridge {
  const dispatch = useAppDispatch();
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string | undefined>);
  const differenceUrls = useAppSelector((state) => state.differenceUrls as Record<string, string | undefined>);

  const currentEventSolutionUrl = useMemo(() => {
    if (!selectedScenario) {
      return null;
    }
    const resolved = resolveEventSequenceSolutionUrl(solutionUrls, selectedScenario.scenarioId, {
      usePerStepKeys: true,
      stepId: currentEventStepId,
      allowLegacyFallback: true,
    });
    return resolved || null;
  }, [currentEventStepId, selectedScenario, solutionUrls]);

  const currentEventDiffUrl = useMemo(() => {
    if (!selectedScenario) {
      return null;
    }
    const resolved = resolveEventSequenceDiffUrl(differenceUrls, selectedScenario.scenarioId, {
      usePerStepKeys: true,
      stepId: currentEventStepId,
    });
    return resolved || null;
  }, [currentEventStepId, differenceUrls, selectedScenario]);

  const currentEventSolutionUrlStale = useMemo(
    () => !currentEventSolutionUrl,
    [currentEventSolutionUrl],
  );

  const currentEventAccuracyRaw = useMemo(() => {
    if (!selectedRuntimeKey) {
      return null;
    }
    return useEventSequenceCaptureStore.getState().getCaptureState(selectedRuntimeKey)
      .stepAccuraciesByStepId[currentEventStepId]?.accuracy ?? null;
  }, [currentEventStepId, selectedRuntimeKey]);

  const setCurrentEventSolutionUrl = useCallback((url: string, stepId?: string | null) => {
    if (!selectedScenario || !url) return;
    const targetStepId = stepId ?? currentEventStepId;
    dispatch(addSolutionUrl({
      solutionUrl: url,
      scenarioId: selectedScenario.scenarioId,
      eventSequenceStepId: targetStepId,
    }));
  }, [currentEventStepId, dispatch, selectedScenario]);

  const setCurrentEventDiffUrl = useCallback((url: string, stepId?: string | null) => {
    if (!selectedScenario || !url) return;
    const targetStepId = stepId ?? currentEventStepId;
    dispatch(addDifferenceUrl({
      differenceUrl: url,
      scenarioId: selectedScenario.scenarioId,
      eventSequenceStepId: targetStepId,
    }));
  }, [currentEventStepId, dispatch, selectedScenario]);

  const setCurrentEventAccuracy = useCallback((accuracy: number, stepId?: string | null) => {
    if (!selectedRuntimeKey) return;
    const targetStepId = stepId ?? currentEventStepId;
    useEventSequenceCaptureStore.getState().setStepAccuracy(selectedRuntimeKey, targetStepId, accuracy);
  }, [currentEventStepId, selectedRuntimeKey]);

  const current = useMemo(() => ({
    stepId: currentEventStepId,
    solutionUrl: currentEventSolutionUrl,
    diffUrl: currentEventDiffUrl,
    solutionUrlStale: currentEventSolutionUrlStale,
    accuracyRaw: currentEventAccuracyRaw,
  }), [
    currentEventAccuracyRaw,
    currentEventDiffUrl,
    currentEventSolutionUrl,
    currentEventSolutionUrlStale,
    currentEventStepId,
  ]);

  const handlers = useMemo(() => ({
    setCurrentEventSolutionUrl,
    setCurrentEventDiffUrl,
    setCurrentEventAccuracy,
  }), [
    setCurrentEventSolutionUrl,
    setCurrentEventDiffUrl,
    setCurrentEventAccuracy,
  ]);

  return useMemo(() => ({ current, handlers }), [current, handlers]);
}
