'use client';

/**
 * EventsBoundScenarioDrawing — Thin orchestrator that wires domain hooks
 * to the presentational ScenarioDrawing component.
 *
 * Structurally mirrors EventsBoundScenarioModel: reads Redux state,
 * delegates all event-sequence logic to focused hooks, and renders
 * the presenter with resolved props.
 */

import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import { ScenarioDrawing } from "@/components/ArtBoards/Drawboard/ScenarioDrawing";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import {
  getEventSequenceRuntimeKey,
  selectRuntimeState,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import { useEventSequencePreview } from "@/events/hooks/useEventSequencePreview";
import { useScenarioArtifacts } from "@/events/hooks/useScenarioArtifacts";
import { useSequenceRuntimeLifecycle } from "@/events/hooks/useSequenceRuntimeLifecycle";
import { useStepAccuracyEngine } from "@/events/hooks/useStepAccuracyEngine";
import type { scenario } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScenarioDrawingProps = {
  scenario: scenario;
  allowScaling?: boolean;
  registerForNavbarCapture?: boolean;
  suppressHeavyLayoutEffects?: boolean;
  creatorPreviewInteractive?: boolean;
  creatorMode?: boolean;
  selectedEventSequenceStepId?: string | null;
  gameplaySolutionStepId?: string | null;
  eventSequenceScopedTriggers?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const EventsBoundScenarioDrawing = ({
  scenario,
  allowScaling = false,
  registerForNavbarCapture = false,
  suppressHeavyLayoutEffects = false,
  creatorPreviewInteractive,
  creatorMode,
  selectedEventSequenceStepId,
  gameplaySolutionStepId = null,
  eventSequenceScopedTriggers = false,
}: ScenarioDrawingProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = creatorMode ?? options.creator;
  const { drawboardCaptureMode } = useGameRuntimeConfig();

  // ---- Sequence runtime ----

  const scenarioSequence = useMemo(
    () => level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [],
    [level?.eventSequence, scenario.scenarioId],
  );
  const runtimeKey = useMemo(
    () => getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, isCreator),
    [currentLevel, isCreator, scenario.scenarioId],
  );
  const sequenceRuntime = useEventSequenceStore((state) => (
    selectRuntimeState(state.runtimeByKey, runtimeKey)
  ));
  const normalizedActiveIndex = sequenceRuntime.activeIndex >= scenarioSequence.length ? 0 : sequenceRuntime.activeIndex;
  const gameplayActiveSequenceStep = scenarioSequence[normalizedActiveIndex] ?? null;

  // ---- Hook 1: Artifact resolution ----

  const artifacts = useScenarioArtifacts({
    scenario,
    isCreator,
    selectedEventSequenceStepId,
    gameplaySolutionStepId,
    scenarioSequence,
  });

  // ---- Hook 2: Event sequence preview ----

  const fallbackEvents = useMemo(() => level?.events || [], [level?.events]);
  const { replaySequence } = useEventSequencePreview({
    isCreator,
    scenarioSequence,
    selectedEventSequenceStepId,
    eventSequenceScopedTriggers,
    recordingMode: sequenceRuntime.recordingMode,
    creatorPreviewInteractive,
    hasCapture: Boolean(artifacts.drawingUrl),
    fallbackEvents,
  });

  // ---- Hook 3: Sequence runtime lifecycle ----

  const compareSourcesFingerprint = useMemo(
    () =>
      `${artifacts.css}\0${artifacts.html}\0${artifacts.js}\0${scenario.js ?? ""}\0${artifacts.resolvedSolutionCss}\0${artifacts.resolvedSolutionHtml}\0${JSON.stringify(scenarioSequence)}`,
    [artifacts.css, artifacts.html, artifacts.js, artifacts.resolvedSolutionCss, artifacts.resolvedSolutionHtml, scenario.js, scenarioSequence],
  );

  useSequenceRuntimeLifecycle({
    scenario,
    currentLevel,
    level,
    isCreator,
    runtimeKey,
    scenarioSequence,
    sequenceRuntime,
    drawboardCaptureMode,
    compareSourcesFingerprint,
    suppressHeavyLayoutEffects,
    gameplayActiveSequenceStep,
  });

  // ---- Hook 4: Step accuracy engine ----

  useStepAccuracyEngine({
    scenarioId: scenario.scenarioId,
    scenarioSequence,
    runtimeKey,
    isCreator,
    selectedEventSequenceStepId,
    replaySequence,
    gameplayActiveSequenceStep,
    drawboardCaptureMode: artifacts.drawboardCaptureMode,
    suppressSequenceMetrics: suppressHeavyLayoutEffects,
    currentLevel,
  });

  // ---- Render ----

  if (!level) return null;

  return (
    <ScenarioDrawing
      scenario={scenario}
      allowScaling={allowScaling}
      registerForNavbarCapture={registerForNavbarCapture}
      suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
      creatorPreviewInteractive={creatorPreviewInteractive}
      creatorMode={isCreator}
      selectedEventSequenceStepId={selectedEventSequenceStepId}
      eventSequenceScopedTriggers={eventSequenceScopedTriggers}
    />
  );
};
