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
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { endReplayBatch } from "@/events/core/eventSequenceFacades";
import type { scenario } from "@/types";

export type ScenarioRuntimeActions = {
  handleSetScenarioAutoReplay: (enabled: boolean) => void;
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
    if (!useSequenceReplayStore.getState().isRunning) return;
    endReplayBatch(selectedRuntimeKey);
  }, [selectedRuntimeKey]);

  const handleStartScenarioEventRun = useCallback(() => {
    if (!selectedRuntimeKey || !selectedScenario) return;
    if (useSequenceReplayStore.getState().isRunning) return;
    useEventSequenceTimelineUiStore.getState().setSelectedStep(
      currentLevel,
      selectedScenario.scenarioId,
      null,
    );
    window.requestAnimationFrame(() => {
      useEventSequenceAutoRunPrefsStore.getState().queueAutoReplayRequest({
        levelId: currentLevel,
        originalSelectedStepId: null,
        runtimeKey: selectedRuntimeKey,
        scenarioId: selectedScenario.scenarioId,
        source: "manual",
        totalSteps: selectedSequenceLength,
      });
    });
  }, [currentLevel, selectedRuntimeKey, selectedScenario, selectedSequenceLength]);

  const handleSetScenarioAutoReplay = useCallback((enabled: boolean) => {
    if (!selectedScenario) return;
    const autoRunPrefs = useEventSequenceAutoRunPrefsStore.getState();
    autoRunPrefs.setAutoReplayOnMount(currentLevel, selectedScenario.scenarioId, enabled);
    if (!enabled) {
      const queuedRequest = autoRunPrefs.queuedAutoReplayRequest;
      if (
        queuedRequest
        && queuedRequest.levelId === currentLevel
        && queuedRequest.scenarioId === selectedScenario.scenarioId
        && queuedRequest.source !== "manual"
      ) {
        autoRunPrefs.clearQueuedAutoReplayRequest();
      }
    }
  }, [currentLevel, selectedScenario]);

  return useMemo(
    () => ({
      handleSetScenarioAutoReplay,
      handleStartScenarioEventRun,
      handleStopScenarioEventRun,
    }),
    [handleSetScenarioAutoReplay, handleStartScenarioEventRun, handleStopScenarioEventRun],
  );
}
