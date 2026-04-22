"use client";

/**
 * useScenarioRuntimeActions — scenario-level run-control mutators.
 *
 * Paired with `useScenarioRuntimeReadModel`: this hook owns the side-effect
 * API (start / stop scenario event run) so the read model stays derivation-only.
 */

import { useCallback, useMemo } from "react";
import { useEventSequenceAutoRunPrefsStore } from "@/events/core/eventSequenceAutoRunPrefsStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { useEventSequenceRunStore } from "@/events/core/eventSequenceRunStore";
import { endReplayBatch } from "@/events/core/eventSequenceFacades";
import type { scenario } from "@/types";

export type ScenarioRuntimeActions = {
  handleStartScenarioEventRun: () => void;
  handleStopScenarioEventRun: () => void;
};

type UseScenarioRuntimeActionsParams = {
  currentLevel: number;
  selectedScenario: scenario | null;
  selectedRuntimeKey: string | null;
  selectedSequenceLength: number;
};

export function useScenarioRuntimeActions({
  currentLevel,
  selectedScenario,
  selectedRuntimeKey,
  selectedSequenceLength,
}: UseScenarioRuntimeActionsParams): ScenarioRuntimeActions {
  const handleStopScenarioEventRun = useCallback(() => {
    if (!selectedRuntimeKey) return;
    useEventSequenceAutoRunPrefsStore.getState().clearQueuedAutoReplayRequest();
    if (!useEventSequenceRunStore.getState().isRunning) return;
    endReplayBatch(selectedRuntimeKey);
  }, [selectedRuntimeKey]);

  const handleStartScenarioEventRun = useCallback(() => {
    if (!selectedRuntimeKey || !selectedScenario) return;
    if (useEventSequenceRunStore.getState().isRunning) return;
    useEventSequenceAutoRunPrefsStore.getState().queueAutoReplayRequest({
      levelId: currentLevel,
      originalSelectedStepId: useEventSequenceTimelineUiStore
        .getState()
        .getSelectedStepIdForScenario(currentLevel, selectedScenario.scenarioId),
      runtimeKey: selectedRuntimeKey,
      scenarioId: selectedScenario.scenarioId,
      source: "manual",
      totalSteps: selectedSequenceLength + 1,
    });
  }, [currentLevel, selectedRuntimeKey, selectedScenario, selectedSequenceLength]);

  return useMemo(
    () => ({
      handleStartScenarioEventRun,
      handleStopScenarioEventRun,
    }),
    [handleStartScenarioEventRun, handleStopScenarioEventRun],
  );
}
