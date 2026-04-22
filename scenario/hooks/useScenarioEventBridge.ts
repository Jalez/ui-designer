"use client";

import { useCallback, useMemo } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { type scenario } from "@/types";
import { addDifferenceUrl } from "@/store/slices/differenceUrls.slice";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import {
  getLatestUsableReplayComparisonResultForStep,
  selectBoardFreshnessMap,
  useArtboardReplayRuntimeStore,
} from "@/events/core/artboardReplayRuntimeStore";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceAccuracyStore";

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
  const freshnessByKey = useArtboardReplayRuntimeStore((state) => state.freshnessByKey);
  const drawingFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, selectedRuntimeKey, "drawing"),
    [freshnessByKey, selectedRuntimeKey],
  );
  const solutionFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, selectedRuntimeKey, "solution"),
    [freshnessByKey, selectedRuntimeKey],
  );

  const currentEventSolutionUrl = useMemo(() => {
    if (!selectedScenario) {
      return null;
    }
    return solutionFreshnessByStep[currentEventStepId]?.imageUrl ?? null;
  }, [currentEventStepId, selectedScenario, solutionFreshnessByStep]);

  const currentEventDiffUrl = useMemo(() => {
    if (!selectedScenario) {
      return null;
    }
    const latestReplayResult = getLatestUsableReplayComparisonResultForStep(
      selectedRuntimeKey ?? "",
      currentEventStepId,
      drawingFreshnessByStep[currentEventStepId]?.fingerprint,
      solutionFreshnessByStep[currentEventStepId]?.fingerprint,
    );
    if (latestReplayResult?.diff) {
      return latestReplayResult.diff;
    }
    return null;
  }, [currentEventStepId, drawingFreshnessByStep, selectedRuntimeKey, selectedScenario, solutionFreshnessByStep]);

  const currentEventSolutionUrlStale = useMemo(
    () => !currentEventSolutionUrl,
    [currentEventSolutionUrl],
  );

  const currentEventAccuracyRaw = useMemo(() => {
    const latestReplayResult = getLatestUsableReplayComparisonResultForStep(
      selectedRuntimeKey ?? "",
      currentEventStepId,
      drawingFreshnessByStep[currentEventStepId]?.fingerprint,
      solutionFreshnessByStep[currentEventStepId]?.fingerprint,
    );
    if (latestReplayResult) {
      return latestReplayResult.accuracy;
    }
    return null;
  }, [currentEventStepId, drawingFreshnessByStep, selectedRuntimeKey, solutionFreshnessByStep]);

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
