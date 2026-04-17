"use client";

import { useMemo } from "react";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { aggregateEventSequenceAccuracy } from "../core/aggregateEventSequenceAccuracy";
import {
  getEventSequenceRuntimeKey,
  type ReplayDiagnosticsState,
  selectRuntimeState,
  useEventSequenceStore,
  type SequenceRuntimeState,
} from "../core/eventSequenceState";
import { findRunningReplayOnlyStepId } from "../core/replayDiagnostics";
import {
  collectStaleStepIds,
  computeShowEventRunControls,
  resolveEffectiveSelectedSequenceStepId,
  resolveFocusedGameStepId,
  resolveGameActiveStepId,
} from "../core/eventsRuntimeDerived";

export type EventsRuntimeValue = {
  autoReplayOnMount: boolean;
  autoReplayQueued: boolean;
  hasFreshSequenceAccuracy: boolean;
  hasReplayJourneyResult: boolean;
  shouldPromptReplayRerun: boolean;
  shouldShakeManualRun: boolean;
  creatorPreviewInteractive: boolean;
  /** Which event step the timeline strip highlights (selection, auto-run cursor, or game fallback). */
  focusedEventStepId: string | null;
  /** Hidden step currently being replayed (replay-only); when set, visible chips defer focus to replay markers. */
  replayRunningHiddenStepId: string | null;
  effectiveSelectedSequenceStepId: string | null;
  gameActiveStepId: string | null;
  isSequencePanelOpen: boolean;
  selectedRuntimeKey: string | null;
  selectedSequenceStepId: string | null;
  sequenceRuntime: SequenceRuntimeState;
  replayDiagnostics: ReplayDiagnosticsState;
  replayHeaderState: {
    mode: "idle" | "running" | "completed" | "stale";
    currentStep: number;
    totalSteps: number;
    percent: number;
    label: string;
  };
  showEventRunControls: boolean;
  staleStepIds: Set<string>;
};

export function useEventsRuntime(): EventsRuntimeValue {
  const {
    creatorPreviewInteractive,
    currentLevel,
    isCreatorContext,
    selectedScenario,
    selectedScenarioSequence,
  } = useScenarioContext();

  const selectedScenarioId = selectedScenario?.scenarioId ?? null;
  const selectedRuntimeKey = selectedScenarioId
    ? getEventSequenceRuntimeKey(currentLevel, selectedScenarioId, isCreatorContext)
    : null;

  const autoReplayOnMount = useEventSequenceStore((state) => (
    selectedScenarioId ? state.autoReplayOnMountByScenario[`${currentLevel}:${selectedScenarioId}`] ?? false : false
  ));
  const autoReplayQueued = useEventSequenceStore((state) => (
    Boolean(
      selectedScenarioId
      && selectedRuntimeKey
      && state.queuedAutoReplayRequest
      && state.queuedAutoReplayRequest.levelId === currentLevel
      && state.queuedAutoReplayRequest.runtimeKey === selectedRuntimeKey
      && state.queuedAutoReplayRequest.scenarioId === selectedScenarioId,
    )
  ));
  const isSequencePanelOpen = useEventSequenceStore((state) => (
    selectedScenarioId ? state.panelOpenByScenario[`${currentLevel}:${selectedScenarioId}`] ?? false : false
  ));
  const selectedSequenceStepId = useEventSequenceStore((state) => (
    selectedScenarioId ? state.selectedStepIdByScenario[`${currentLevel}:${selectedScenarioId}`] ?? null : null
  ));
  const sequenceRuntime = useEventSequenceStore((state) => (
    selectRuntimeState(state.runtimeByKey, selectedRuntimeKey)
  ));

  const effectiveSelectedSequenceStepId = resolveEffectiveSelectedSequenceStepId(
    isCreatorContext,
    isSequencePanelOpen,
    selectedSequenceStepId,
  );

  const gameActiveStepId = resolveGameActiveStepId(
    isCreatorContext,
    selectedScenarioSequence,
    sequenceRuntime.activeIndex,
  );

  const replayRunningHiddenStepId = useMemo(
    () => findRunningReplayOnlyStepId(selectedScenarioSequence, sequenceRuntime.replayDiagnostics),
    [selectedScenarioSequence, sequenceRuntime.replayDiagnostics],
  );

  const focusedEventStepId = resolveFocusedGameStepId({
    isCreatorContext,
    isSequencePanelOpen,
    selectedSequenceStepId,
    scenarioSequence: selectedScenarioSequence,
    activeIndex: sequenceRuntime.activeIndex,
  });

  const staleStepIds = useMemo(
    () => collectStaleStepIds(sequenceRuntime),
    [sequenceRuntime],
  );
  const hasFreshSequenceAccuracy = useMemo(
    () => aggregateEventSequenceAccuracy(selectedScenarioSequence, sequenceRuntime) !== null,
    [selectedScenarioSequence, sequenceRuntime],
  );
  const hasReplayJourneyResult = sequenceRuntime.replayJourney.lastCompletedAt !== null;
  const shouldPromptReplayRerun = Boolean(
    hasReplayJourneyResult
    && sequenceRuntime.replayJourney.lastCompletedDrawingVersion !== null
    && sequenceRuntime.drawingVersion > sequenceRuntime.replayJourney.lastCompletedDrawingVersion,
  );
  const replayHeaderState = useMemo(() => {
    if (sequenceRuntime.replayJourney.active && sequenceRuntime.replayJourney.totalSteps > 0) {
      const percent = Math.round(
        (sequenceRuntime.replayJourney.currentStep / sequenceRuntime.replayJourney.totalSteps) * 100,
      );
      return {
        mode: "running" as const,
        currentStep: Math.min(
          Math.ceil(sequenceRuntime.replayJourney.currentStep),
          sequenceRuntime.replayJourney.totalSteps,
        ),
        totalSteps: sequenceRuntime.replayJourney.totalSteps,
        percent,
        label: `Running replay ${Math.min(
          Math.ceil(sequenceRuntime.replayJourney.currentStep),
          sequenceRuntime.replayJourney.totalSteps,
        )}/${sequenceRuntime.replayJourney.totalSteps}`,
      };
    }

    if (shouldPromptReplayRerun) {
      return {
        mode: "stale" as const,
        currentStep: sequenceRuntime.replayJourney.totalSteps,
        totalSteps: sequenceRuntime.replayJourney.totalSteps,
        percent: 100,
        label: "Re-run events to update accuracy",
      };
    }

    if (hasReplayJourneyResult && sequenceRuntime.replayJourney.totalSteps > 0) {
      return {
        mode: "completed" as const,
        currentStep: sequenceRuntime.replayJourney.totalSteps,
        totalSteps: sequenceRuntime.replayJourney.totalSteps,
        percent: 100,
        label: `Replay complete ${sequenceRuntime.replayJourney.totalSteps}/${sequenceRuntime.replayJourney.totalSteps}`,
      };
    }

    return {
      mode: "idle" as const,
      currentStep: 0,
      totalSteps: 0,
      percent: 0,
      label: "Events",
    };
  }, [hasReplayJourneyResult, sequenceRuntime.replayJourney, shouldPromptReplayRerun]);

  const showEventRunControls = useMemo(
    () => computeShowEventRunControls(
      selectedScenarioId,
      selectedScenarioSequence.length,
      sequenceRuntime.recordingMode,
      selectedRuntimeKey,
    ),
    [
      selectedScenarioId,
      selectedScenarioSequence.length,
      sequenceRuntime.recordingMode,
      selectedRuntimeKey,
    ],
  );
  const shouldShakeManualRun = showEventRunControls
    && shouldPromptReplayRerun
    && !sequenceRuntime.autoReplay?.running;

  return useMemo(() => ({
    autoReplayOnMount,
    autoReplayQueued,
    hasFreshSequenceAccuracy,
    hasReplayJourneyResult,
    shouldPromptReplayRerun,
    shouldShakeManualRun,
    creatorPreviewInteractive,
    focusedEventStepId,
    replayRunningHiddenStepId,
    effectiveSelectedSequenceStepId: effectiveSelectedSequenceStepId ?? null,
    gameActiveStepId,
    isSequencePanelOpen,
    selectedRuntimeKey,
    selectedSequenceStepId,
    sequenceRuntime,
    replayDiagnostics: sequenceRuntime.replayDiagnostics,
    replayHeaderState,
    showEventRunControls,
    staleStepIds,
  }), [
    autoReplayOnMount,
    autoReplayQueued,
    hasFreshSequenceAccuracy,
    hasReplayJourneyResult,
    shouldPromptReplayRerun,
    shouldShakeManualRun,
    creatorPreviewInteractive,
    focusedEventStepId,
    replayRunningHiddenStepId,
    effectiveSelectedSequenceStepId,
    gameActiveStepId,
    isSequencePanelOpen,
    selectedRuntimeKey,
    selectedSequenceStepId,
    sequenceRuntime,
    replayHeaderState,
    showEventRunControls,
    staleStepIds,
  ]);
}
