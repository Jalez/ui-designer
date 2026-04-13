"use client";

import { useMemo } from "react";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { aggregateEventSequenceAccuracy } from "../core/aggregateEventSequenceAccuracy";
import {
  getEventSequenceRuntimeKey,
  selectRuntimeState,
  useEventSequenceStore,
  type SequenceRuntimeState,
} from "../core/eventSequenceState";
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
  effectiveSelectedSequenceStepId: string | null;
  gameActiveStepId: string | null;
  isSequencePanelOpen: boolean;
  selectedRuntimeKey: string | null;
  selectedSequenceStepId: string | null;
  sequenceRuntime: SequenceRuntimeState;
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
    effectiveSelectedSequenceStepId: effectiveSelectedSequenceStepId ?? null,
    gameActiveStepId,
    isSequencePanelOpen,
    selectedRuntimeKey,
    selectedSequenceStepId,
    sequenceRuntime,
    showEventRunControls,
    staleStepIds,
  }), [
    autoReplayOnMount,
    autoReplayQueued,
    hasFreshSequenceAccuracy,
    creatorPreviewInteractive,
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
