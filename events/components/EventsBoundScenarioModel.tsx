/** @format */
"use client";

import { useMemo } from "react";
import { ScenarioModel } from "@/components/ArtBoards/ModelBoard/ScenarioModel";
import { useAppSelector } from "@/store/hooks/hooks";
import {
  getEventSequenceRuntimeKey,
  selectRuntimeState,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import { defaultTimelineStepIdForSolutionCapture } from "@/events/core/eventSequenceSolutionUrls";
import { useEventSequencePreview } from "@/events/hooks/useEventSequencePreview";
import { useScenarioArtifacts } from "@/events/hooks/useScenarioArtifacts";
import type { scenario } from "@/types";

type EventsBoundScenarioModelProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
  creatorPreviewInteractive?: boolean;
  creatorMode?: boolean;

  selectedEventSequenceStepId?: string | null;
  gameplaySolutionStepId?: string | null;
  eventSequenceScopedTriggers?: boolean;
  forceEmptyReplaySequence?: boolean;
};

export const EventsBoundScenarioModel = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
  creatorPreviewInteractive,
  creatorMode,
  selectedEventSequenceStepId,
  gameplaySolutionStepId = null,
  eventSequenceScopedTriggers = false,
  forceEmptyReplaySequence = false,
}: EventsBoundScenarioModelProps) => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = creatorMode ?? options.mode === "creator";

  const scenarioSequence = level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];

  const solutionStepIdForCapture = useMemo(() => {
    if (scenarioSequence.length > 0) {
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed) return defaultTimelineStepIdForSolutionCapture(scrubbed);
      if (!isCreator && gameplaySolutionStepId != null) {
        return defaultTimelineStepIdForSolutionCapture(gameplaySolutionStepId);
      }
    }
    return defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId);
  }, [gameplaySolutionStepId, isCreator, scenarioSequence.length, selectedEventSequenceStepId]);

  const runtimeKey = useMemo(
    () => getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, isCreator),
    [currentLevel, isCreator, scenario.scenarioId],
  );

  const sequenceRuntime = useEventSequenceStore((state) => (
    selectRuntimeState(state.runtimeByKey, runtimeKey)
  ));

  const fallbackEvents = useMemo(() => level?.events ?? [], [level]);

  const artifacts = useScenarioArtifacts({
    scenario,
    isCreator,
    selectedEventSequenceStepId,
    gameplaySolutionStepId,
    scenarioSequence,
  });

  /**
   * Mirror `EventsBoundScenarioDrawing`: drawing uses `hasCapture: Boolean(artifacts.drawingUrl)` so
   * `useEventSequencePreview` toggles interactive preview consistently. Model uses solution URL presence.
   */
  const hasCapture = Boolean(artifacts.solutionUrl?.trim());

  const {
    replaySequence,
    interactionTriggers,
    shouldShowInteractivePreview,
    isSequenceRecording,
  } = useEventSequencePreview({
    isCreator,
    scenarioSequence,
    selectedEventSequenceStepId,
    eventSequenceScopedTriggers,
    recordingMode: sequenceRuntime.recordingMode,
    creatorPreviewInteractive,
    hasCapture,
    fallbackEvents,
  });

  return (
    <ScenarioModel
      scenario={scenario}
      allowScaling={allowScaling}
      registerForNavbarCapture={registerForNavbarCapture}
      suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
      creatorPreviewInteractive={creatorPreviewInteractive}
      creatorMode={isCreator}
      activeSolutionStepId={solutionStepIdForCapture}
      showInteractivePreview={shouldShowInteractivePreview}
      interactiveSnapshotOverride={null}
      replaySequence={replaySequence}
      interactionTriggers={interactionTriggers}
      isSequenceRecording={isSequenceRecording || sequenceRuntime.recordingMode !== "idle"}
      forceEmptyReplaySequence={forceEmptyReplaySequence}
      scenarioSequenceLength={scenarioSequence.length}
    />
  );
};
