"use client";

import { useCallback, useMemo } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { updateEventSequenceStep } from "@/store/slices/levels.slice";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { getEventSequenceRuntimeKey, useEventSequenceStore } from "@/events/core/eventSequenceState";

export type EventsActionsValue = {
  handleStartScenarioEventRun: () => void;
  handleStopScenarioEventRun: () => void;
  handleSelectStep: (stepId: string) => void;
  handleUpdateStep: (stepId: string, field: "label" | "instruction", value: string) => void;
};

export function useEventsActions(): EventsActionsValue {
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const {
    currentLevel,
    isCreatorContext,
    selectedScenario,
    selectedScenarioSequence,
  } = useScenarioContext();
  const selectedScenarioId = selectedScenario?.scenarioId ?? null;
  const selectedRuntimeKey = selectedScenarioId
    ? getEventSequenceRuntimeKey(currentLevel, selectedScenarioId, isCreatorContext)
    : null;

  const handleStopScenarioEventRun = useCallback(() => {
    if (!selectedRuntimeKey) {
      return;
    }
    useEventSequenceStore.getState().clearQueuedAutoReplayRequest();
    const running = useEventSequenceStore.getState().getRuntimeState(selectedRuntimeKey).autoReplay?.running;
    if (!running) {
      return;
    }
    useEventSequenceStore.getState().stopAutoReplay(selectedRuntimeKey);
  }, [selectedRuntimeKey]);

  const handleStartScenarioEventRun = useCallback(() => {
    if (!selectedRuntimeKey || !selectedScenario) {
      return;
    }
    if (useEventSequenceStore.getState().getRuntimeState(selectedRuntimeKey).autoReplay?.running) {
      return;
    }
    useEventSequenceStore.getState().queueAutoReplayRequest({
      levelId: currentLevel,
      runtimeKey: selectedRuntimeKey,
      scenarioId: selectedScenario.scenarioId,
      source: "manual",
      totalSteps: selectedScenarioSequence.length + 1,
    });
  }, [currentLevel, selectedRuntimeKey, selectedScenario, selectedScenarioSequence.length]);

  const handleUpdateStep = useCallback((stepId: string, field: "label" | "instruction", value: string) => {
    if (!selectedScenario) {
      return;
    }
    dispatch(updateEventSequenceStep({
      levelId: currentLevel,
      scenarioId: selectedScenario.scenarioId,
      stepId,
      changes: { [field]: value },
    }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
  }, [currentLevel, dispatch, selectedScenario, syncLevelFields]);

  const handleSelectStep = useCallback((stepId: string) => {
    if (!selectedScenario) {
      return;
    }
    useEventSequenceStore.getState().setSelectedStep(currentLevel, selectedScenario.scenarioId, stepId);
  }, [currentLevel, selectedScenario]);

  return useMemo(() => ({
    handleStartScenarioEventRun,
    handleStopScenarioEventRun,
    handleSelectStep,
    handleUpdateStep,
  }), [
    handleStartScenarioEventRun,
    handleStopScenarioEventRun,
    handleSelectStep,
    handleUpdateStep,
  ]);
}
