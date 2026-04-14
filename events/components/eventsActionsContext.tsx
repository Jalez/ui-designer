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
    // #region agent log
    fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17d204" },
      body: JSON.stringify({
        sessionId: "17d204",
        hypothesisId: "H5",
        location: "eventsActionsContext.tsx:handleStartScenarioEventRun",
        message: "queued_manual_scenario_run",
        data: {
          scenarioId: selectedScenario.scenarioId,
          totalStepsQueued: selectedScenarioSequence.length + 1,
          runtimeKey: selectedRuntimeKey,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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
