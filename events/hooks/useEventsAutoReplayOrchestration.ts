import { useEffect } from "react";
import { beginReplayBatch } from "@/events/core/eventSequenceFacades";
import type { EventSequenceStep } from "@/types";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceAutoRunPrefsStore } from "@/events/core/eventSequenceAutoRunPrefsStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { logArtboardReplayDebug } from "@/events/core/artboardReplayRuntimeStore";

export function useEventsAutoReplayOrchestration({
  autoReplayOnMount,
  autoReplayMountReady,
  currentLevel,
  selectedRuntimeKey,
  selectedScenarioId,
  selectedScenarioSequence,
}: {
  autoReplayOnMount: boolean;
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
      && autoReplayOnMount
      && !useEventSequenceAutoRunPrefsStore.getState().hasAutoReplayMountedRun(currentLevel, selectedScenarioId)
      && !eventSequenceRunIsActive
      && !queuedRequestMatchesSelection
    ) {
      const autoRunPrefs = useEventSequenceAutoRunPrefsStore.getState();
      const latestQueuedRequest = autoRunPrefs.queuedAutoReplayRequest;
      if (
        latestQueuedRequest
        && latestQueuedRequest.levelId === currentLevel
        && latestQueuedRequest.runtimeKey === selectedRuntimeKey
        && latestQueuedRequest.scenarioId === selectedScenarioId
      ) {
        logArtboardReplayDebug("queue-mount-auto-replay-skip", {
          reason: "latest-request-exists",
          existingSource: latestQueuedRequest.source,
          levelId: currentLevel,
          runtimeKey: selectedRuntimeKey,
          scenarioId: selectedScenarioId,
        });
        return;
      }
      const restoreStepId =
        useEventSequenceTimelineUiStore
          .getState()
          .getSelectedStepIdForScenario(currentLevel, selectedScenarioId)
        ?? null;
      const request = {
        levelId: currentLevel,
        originalSelectedStepId: restoreStepId,
        runtimeKey: selectedRuntimeKey,
        scenarioId: selectedScenarioId,
        source: "mount",
        totalSteps: displayStepCount,
      } as const;
      logArtboardReplayDebug("queue-mount-auto-replay", request);
      autoRunPrefs.queueAutoReplayRequest(request);
    }
  }, [
    autoReplayOnMount,
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
    if (autoReplayOnMount || !queuedRequestMatchesSelection || !queuedAutoReplayRequest) {
      return;
    }
    if (queuedAutoReplayRequest.source !== "manual") {
      useEventSequenceAutoRunPrefsStore.getState().clearQueuedAutoReplayRequest();
    }
  }, [autoReplayOnMount, queuedAutoReplayRequest, queuedRequestMatchesSelection]);

  useEffect(() => {
    if (!queuedRequestMatchesSelection || !queuedAutoReplayRequest) {
      return;
    }
    const shouldWaitForMountReady =
      queuedAutoReplayRequest.source === "mount" && !autoReplayMountReady;
    if (shouldWaitForMountReady || eventSequenceRunIsActive) {
      logArtboardReplayDebug("auto-replay-start-wait", {
        source: queuedAutoReplayRequest.source,
        shouldWaitForMountReady,
        eventSequenceRunIsActive,
        runtimeKey: selectedRuntimeKey,
        scenarioId: selectedScenarioId,
      });
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
    if (!autoReplayOnMount && latestRequest.source !== "manual") {
      state.clearQueuedAutoReplayRequest();
      return;
    }
    if (useSequenceReplayStore.getState().isRunning) return;

    if (latestRequest.source === "mount") {
      state.markAutoReplayMountedRun(levelId, scenarioId);
    }
    state.clearQueuedAutoReplayRequest();
    logArtboardReplayDebug("auto-replay-begin-batch", {
      source: latestRequest.source,
      runtimeKey: latestRequest.runtimeKey,
      scenarioId: latestRequest.scenarioId,
      totalSteps: latestRequest.totalSteps,
      originalSelectedStepId: latestRequest.originalSelectedStepId,
    });
    beginReplayBatch(
      latestRequest.runtimeKey,
      latestRequest.totalSteps,
      latestRequest.originalSelectedStepId,
    );
  }, [
    autoReplayOnMount,
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
