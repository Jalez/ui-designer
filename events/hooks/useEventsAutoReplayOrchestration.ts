import { useEffect } from "react";
import type { EventSequenceStep } from "@/types";
import {
  useEventSequenceStore,
  type SequenceRuntimeState,
} from "@/events/core/eventSequenceState";

export function useEventsAutoReplayOrchestration({
  autoReplayMountReady,
  currentLevel,
  selectedRuntimeKey,
  selectedScenarioId,
  selectedScenarioSequence,
  sequenceRuntime,
}: {
  autoReplayMountReady: boolean;
  currentLevel: number;
  selectedRuntimeKey: string | null;
  selectedScenarioId: string | null;
  selectedScenarioSequence: EventSequenceStep[];
  sequenceRuntime: SequenceRuntimeState;
}) {
  const queuedAutoReplayRequest = useEventSequenceStore((state) => state.queuedAutoReplayRequest);
  const queuedRequestMatchesSelection =
    queuedAutoReplayRequest
    && queuedAutoReplayRequest.levelId === currentLevel
    && queuedAutoReplayRequest.runtimeKey === selectedRuntimeKey
    && queuedAutoReplayRequest.scenarioId === selectedScenarioId;

  useEffect(() => {
    if (
      selectedScenarioId
      && selectedRuntimeKey
      && selectedScenarioSequence.length > 0
      && !useEventSequenceStore.getState().hasAutoReplayMountedRun(currentLevel, selectedScenarioId)
      && !sequenceRuntime.autoReplay?.running
      && (!queuedRequestMatchesSelection || queuedAutoReplayRequest.source !== "mount")
    ) {
      useEventSequenceStore.getState().queueAutoReplayRequest({
        levelId: currentLevel,
        originalSelectedStepId: useEventSequenceStore
          .getState()
          .getSelectedStepIdForScenario(currentLevel, selectedScenarioId),
        runtimeKey: selectedRuntimeKey,
        scenarioId: selectedScenarioId,
        source: "mount",
        totalSteps: selectedScenarioSequence.length + 1,
      });
    }
  }, [
    currentLevel,
    queuedAutoReplayRequest?.source,
    queuedRequestMatchesSelection,
    selectedRuntimeKey,
    selectedScenarioId,
    selectedScenarioSequence.length,
    sequenceRuntime.autoReplay?.running,
  ]);

  useEffect(() => {
    if (!queuedRequestMatchesSelection || !queuedAutoReplayRequest) {
      return;
    }
    const shouldWaitForMountReady =
      queuedAutoReplayRequest.source === "mount" && !autoReplayMountReady;
    if (shouldWaitForMountReady || sequenceRuntime.autoReplay?.running) {
      return;
    }
    queueMicrotask(() => {
      const state = useEventSequenceStore.getState();
      const latestRequest = state.queuedAutoReplayRequest;
      if (
        !latestRequest
        || latestRequest.levelId !== currentLevel
        || latestRequest.runtimeKey !== selectedRuntimeKey
        || latestRequest.scenarioId !== selectedScenarioId
      ) {
        return;
      }
      if (latestRequest.source === "mount" && selectedScenarioId) {
        state.markAutoReplayMountedRun(currentLevel, selectedScenarioId);
      }
      state.clearQueuedAutoReplayRequest();
      state.startAutoReplay(
        latestRequest.runtimeKey,
        latestRequest.totalSteps,
        latestRequest.originalSelectedStepId,
      );
    });
  }, [
    autoReplayMountReady,
    currentLevel,
    queuedAutoReplayRequest,
    queuedRequestMatchesSelection,
    selectedRuntimeKey,
    selectedScenarioId,
    sequenceRuntime.autoReplay?.running,
  ]);

  useEffect(() => {
    if (selectedRuntimeKey || !queuedAutoReplayRequest) {
      return;
    }
    useEventSequenceStore.getState().clearQueuedAutoReplayRequest();
  }, [queuedAutoReplayRequest, selectedRuntimeKey]);
}
