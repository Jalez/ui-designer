import { useEffect } from "react";
import { beginReplayBatch } from "@/events/core/eventSequenceFacades";
import type { EventSequenceStep } from "@/types";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceAutoRunPrefsStore } from "@/events/core/eventSequenceAutoRunPrefsStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";

export function useEventsAutoReplayOrchestration({
  autoReplayMountReady,
  currentLevel,
  selectedRuntimeKey,
  selectedScenarioId,
  selectedScenarioSequence,
}: {
  autoReplayMountReady: boolean;
  currentLevel: number;
  selectedRuntimeKey: string | null;
  selectedScenarioId: string | null;
  selectedScenarioSequence: EventSequenceStep[];
}) {
  const displayStepCount = selectedScenarioSequence.length;
  const eventSequenceRunIsActive = useSequenceReplayStore((state) => state.isRunning);
  const queuedAutoReplayRequest = useEventSequenceAutoRunPrefsStore((state) => state.queuedAutoReplayRequest);
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
      && !useEventSequenceAutoRunPrefsStore.getState().hasAutoReplayMountedRun(currentLevel, selectedScenarioId)
      && !eventSequenceRunIsActive
      && (!queuedRequestMatchesSelection || queuedAutoReplayRequest.source !== "mount")
    ) {
      const restoreStepId =
        useEventSequenceTimelineUiStore
          .getState()
          .getSelectedStepIdForScenario(currentLevel, selectedScenarioId)
        ?? null;
      useEventSequenceAutoRunPrefsStore.getState().queueAutoReplayRequest({
        levelId: currentLevel,
        originalSelectedStepId: restoreStepId,
        runtimeKey: selectedRuntimeKey,
        scenarioId: selectedScenarioId,
        source: "mount",
        totalSteps: displayStepCount,
      });
    }
  }, [
    currentLevel,
    queuedAutoReplayRequest?.source,
    queuedRequestMatchesSelection,
    displayStepCount,
    selectedRuntimeKey,
    selectedScenarioId,
    selectedScenarioSequence,
    eventSequenceRunIsActive,
  ]);

  useEffect(() => {
    if (!queuedRequestMatchesSelection || !queuedAutoReplayRequest) {
      return;
    }
    const shouldWaitForMountReady =
      queuedAutoReplayRequest.source === "mount" && !autoReplayMountReady;
    if (shouldWaitForMountReady || eventSequenceRunIsActive) {
      return;
    }
    if (!selectedRuntimeKey || !selectedScenarioId) return;

    const runtimeKey = selectedRuntimeKey;
    const scenarioId = selectedScenarioId;
    const levelId = currentLevel;

    const state = useEventSequenceAutoRunPrefsStore.getState();
    const latestRequest = state.queuedAutoReplayRequest;
    if (
      !latestRequest
      || latestRequest.levelId !== levelId
      || latestRequest.runtimeKey !== runtimeKey
      || latestRequest.scenarioId !== scenarioId
    ) {
      return;
    }
    if (useSequenceReplayStore.getState().isRunning) return;

    if (latestRequest.source === "mount") {
      state.markAutoReplayMountedRun(levelId, scenarioId);
    }
    state.clearQueuedAutoReplayRequest();
    beginReplayBatch(
      latestRequest.runtimeKey,
      latestRequest.totalSteps,
      latestRequest.originalSelectedStepId,
    );
  }, [
    autoReplayMountReady,
    currentLevel,
    queuedAutoReplayRequest,
    queuedRequestMatchesSelection,
    selectedRuntimeKey,
    selectedScenarioId,
    eventSequenceRunIsActive,
  ]);

  useEffect(() => {
    if (selectedRuntimeKey || !queuedAutoReplayRequest) {
      return;
    }
    useEventSequenceAutoRunPrefsStore.getState().clearQueuedAutoReplayRequest();
  }, [queuedAutoReplayRequest, selectedRuntimeKey]);
}
