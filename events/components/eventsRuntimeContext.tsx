"use client";

import { useEffect, useMemo } from "react";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { aggregateEventSequenceAccuracy } from "../core/aggregateEventSequenceAccuracy";
import {
  getEventSequenceRuntimeKey,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
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
  resolveGameActiveStepId,
} from "../core/eventsRuntimeDerived";

export type EventsRuntimeValue = {
  autoReplayOnMount: boolean;
  autoReplayQueued: boolean;
  hasFreshSequenceAccuracy: boolean;
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

  const autoReplayFocusedStepId = useMemo(() => {
    const ar = sequenceRuntime.autoReplay;
    if (!ar?.running) {
      return null;
    }
    const timeline = selectedScenarioSequence.filter((s) => s.showInTimeline !== false);
    const ids = [INITIAL_EVENT_SEQUENCE_STEP_ID, ...timeline.map((s) => s.id)];
    return ids[ar.stepIndex] ?? null;
  }, [sequenceRuntime.autoReplay, selectedScenarioSequence]);

  const replayRunningHiddenStepId = useMemo(
    () => findRunningReplayOnlyStepId(selectedScenarioSequence, sequenceRuntime.replayDiagnostics),
    [selectedScenarioSequence, sequenceRuntime.replayDiagnostics],
  );

  const focusedEventStepId = useMemo(() => {
    /** Replay-only steps run before capture/compare on the visible target — highlight markers first. */
    if (replayRunningHiddenStepId != null) {
      return null;
    }
    if (selectedSequenceStepId != null) {
      return selectedSequenceStepId;
    }
    if (autoReplayFocusedStepId != null) {
      return autoReplayFocusedStepId;
    }
    return effectiveSelectedSequenceStepId ?? gameActiveStepId;
  }, [
    replayRunningHiddenStepId,
    selectedSequenceStepId,
    autoReplayFocusedStepId,
    effectiveSelectedSequenceStepId,
    gameActiveStepId,
  ]);

  // #region agent log
  useEffect(() => {
    const ar = sequenceRuntime.autoReplay;
    fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17d204" },
      body: JSON.stringify({
        sessionId: "17d204",
        hypothesisId: "H1-H2-H3",
        location: "eventsRuntimeContext.tsx:focusSnapshot",
        message: "derived_focus_inputs",
        data: {
          focusedEventStepId,
          replayRunningHiddenStepId,
          selectedSequenceStepId,
          autoReplayFocusedStepId,
          arRunning: ar?.running ?? false,
          arStepIndex: ar?.stepIndex ?? null,
          arTotal: ar?.totalSteps ?? null,
          diagActiveStepId: sequenceRuntime.replayDiagnostics.activeStepId,
          diagSignature: sequenceRuntime.replayDiagnostics.activeSignature,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [
    focusedEventStepId,
    replayRunningHiddenStepId,
    selectedSequenceStepId,
    autoReplayFocusedStepId,
    sequenceRuntime.autoReplay,
    sequenceRuntime.replayDiagnostics.activeStepId,
    sequenceRuntime.replayDiagnostics.activeSignature,
  ]);
  // #endregion

  const staleStepIds = useMemo(
    () => collectStaleStepIds(sequenceRuntime),
    [sequenceRuntime],
  );
  const hasFreshSequenceAccuracy = useMemo(
    () => aggregateEventSequenceAccuracy(selectedScenarioSequence, sequenceRuntime) !== null,
    [selectedScenarioSequence, sequenceRuntime],
  );

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

  return useMemo(() => ({
    autoReplayOnMount,
    autoReplayQueued,
    hasFreshSequenceAccuracy,
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
    showEventRunControls,
    staleStepIds,
  }), [
    autoReplayOnMount,
    autoReplayQueued,
    hasFreshSequenceAccuracy,
    creatorPreviewInteractive,
    focusedEventStepId,
    replayRunningHiddenStepId,
    effectiveSelectedSequenceStepId,
    gameActiveStepId,
    isSequencePanelOpen,
    selectedRuntimeKey,
    selectedSequenceStepId,
    sequenceRuntime,
    showEventRunControls,
    staleStepIds,
  ]);
}
