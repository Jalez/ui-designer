'use client';

/**
 * EventsBoundScenarioDrawing — Orchestrator that wires all domain hooks
 * and provides ScenarioDrawingContext for its subtree.
 *
 * Owns: artifact resolution, step preview rendering, accuracy engine,
 * sequence lifecycle, batch replay, session step capture tracking.
 * Resolved values are exposed via context — ScenarioDrawing reads them
 * directly rather than receiving them as props.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { ScenarioDrawing } from "@/components/ArtBoards/Drawboard/ScenarioDrawing";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import {
  buildArtifactKey,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import {
  getEventSequenceRuntimeKey,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  selectRuntimeState,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import {
  getSessionStepDrawingCapture,
  subscribeSessionStepDrawingCaptures,
} from "@/lib/drawboard/drawboardPixelsStore";
import { defaultTimelineStepIdForSolutionCapture } from "@/events/core/eventSequenceSolutionUrls";
import { useEventSequencePreview } from "@/events/hooks/useEventSequencePreview";
import { useScenarioArtifacts } from "@/events/hooks/useScenarioArtifacts";
import { useSequenceRuntimeLifecycle } from "@/events/hooks/useSequenceRuntimeLifecycle";
import { useStepAccuracyEngine } from "@/events/hooks/useStepAccuracyEngine";
import { useStepPreviewRenderer } from "@/events/hooks/useStepPreviewRenderer";
import { useBatchReplayOrchestration } from "@/events/hooks/useBatchReplayOrchestration";
import {
  ScenarioDrawingContext,
} from "@/events/components/ScenarioDrawingContext";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import type { scenario } from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventsBoundScenarioDrawingProps = {
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
}: EventsBoundScenarioDrawingProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const dispatch = useAppDispatch();
  const isCreator = creatorMode ?? options.mode === "creator";
  const { drawboardCaptureMode } = useGameRuntimeConfig();

  // ---- Frame ref (shared with batch replay orchestration) ----

  const drawingFrameRef = useRef<FrameHandle | null>(null);
  const [drawingFrameReadyVersion, setDrawingFrameReadyVersion] = useState(0);
  const handleFrameReady = useCallback((instance: FrameHandle | null) => {
    drawingFrameRef.current = instance;
    setDrawingFrameReadyVersion((v) => v + 1);
  }, []);

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
  const autoReplayRunning = Boolean(sequenceRuntime.autoReplay?.running);

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
  const {
    replaySequence,
    interactionTriggers: frameEvents,
    shouldShowInteractivePreview,
    frameNeedsInteractive,
    isSequenceRecording,
  } = useEventSequencePreview({
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

  const { handleVerifiedInteraction } = useSequenceRuntimeLifecycle({
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

  // ---- Hook 5: Step preview renderer ----

  const handleStepRendered = useCallback((
    stepId: string,
    descriptor: DrawboardArtifactDescriptor,
    dataUrl: string,
  ) => {
    dispatch(addSolutionUrl({
      solutionUrl: dataUrl,
      scenarioId: scenario.scenarioId,
      storageKey: buildArtifactKey(descriptor),
      eventSequenceStepId: stepId,
    }));
  }, [dispatch, scenario.scenarioId]);

  const { stepPreviews } = useStepPreviewRenderer({
    scenarioSequence,
    scenarioId: scenario.scenarioId,
    resolvedSolutionCss: artifacts.resolvedSolutionCss,
    resolvedSolutionHtml: artifacts.resolvedSolutionHtml,
    solutionFingerprint: artifacts.solutionFingerprint,
    buildDescriptor: artifacts.buildDescriptor,
    suppressSequenceMetrics: suppressHeavyLayoutEffects,
    onStepRendered: handleStepRendered,
  });

  // ---- Session step capture tracking (effectiveDrawingUrl) ----

  const sessionStepCaptureCacheKey = useMemo(
    () => `${runtimeKey}:${drawboardCaptureMode}:${artifacts.drawingArtifactDescriptor.fingerprint}:${sequenceRuntime.drawingVersion}`,
    [artifacts.drawingArtifactDescriptor.fingerprint, drawboardCaptureMode, runtimeKey, sequenceRuntime.drawingVersion],
  );

  const currentDrawingStepId = useMemo(() => {
    if (scenarioSequence.length > 0) {
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed) return scrubbed;
      if (!isCreator && gameplaySolutionStepId != null) return gameplaySolutionStepId;
      return INITIAL_EVENT_SEQUENCE_STEP_ID;
    }
    return defaultTimelineStepIdForSolutionCapture(selectedEventSequenceStepId);
  }, [gameplaySolutionStepId, isCreator, scenarioSequence.length, selectedEventSequenceStepId]);

  const [, setSessionStepCaptureSerial] = useState(0);
  useEffect(() => {
    setSessionStepCaptureSerial((v) => v + 1);
    return subscribeSessionStepDrawingCaptures(sessionStepCaptureCacheKey, () => {
      setSessionStepCaptureSerial((v) => v + 1);
    });
  }, [sessionStepCaptureCacheKey]);

  const currentSessionStepCapture = getSessionStepDrawingCapture(sessionStepCaptureCacheKey, currentDrawingStepId);
  const effectiveDrawingUrl = currentSessionStepCapture?.dataUrl ?? artifacts.drawingUrl;

  // ---- Derived values ----

  const batchVisibleStepIds = useMemo(
    () => [INITIAL_EVENT_SEQUENCE_STEP_ID, ...scenarioSequence.map((step) => step.id)],
    [scenarioSequence],
  );

  const shouldBypassSelectedStepReplay =
    isCreator && !shouldShowInteractivePreview && !autoReplayRunning && Boolean(currentSessionStepCapture);

  // ---- Hook 6: Batch replay orchestration ----

  const { handleReplayBatchStatus, handleReplayBatchCheckpoint } = useBatchReplayOrchestration({
    drawingFrameRef,
    drawingFrameReadyVersion,
    runtimeKey,
    currentLevel,
    scenarioId: scenario.scenarioId,
    scenarioDimensions: scenario.dimensions,
    scenarioSequence,
    batchVisibleStepIds,
    sessionStepCaptureCacheKey,
    currentDrawingStepId,
    drawingArtifactKey: buildArtifactKey(artifacts.drawingArtifactDescriptor),
    autoReplay: sequenceRuntime.autoReplay ?? null,
    stepPreviews,
    getStepSolutionUrl: artifacts.getStepSolutionUrl,
    drawboardCaptureMode,
    suppressSequenceMetrics: suppressHeavyLayoutEffects,
  });

  // ---- Context value ----

  const contextValue = useMemo(() => ({
    isCreator,
    solutionUrl: artifacts.solutionUrl,
    effectiveDrawingUrl,
    drawingArtifactDescriptor: artifacts.drawingArtifactDescriptor,
    sessionStepCaptureCacheKey,
    frameEvents,
    replaySequence,
    shouldShowInteractivePreview,
    frameNeedsInteractive,
    isSequenceRecording,
    autoReplayRunning,
    shouldBypassSelectedStepReplay,
    onFrameReady: handleFrameReady,
    onVerifiedInteraction: handleVerifiedInteraction,
    onReplayBatchCheckpoint: (checkpoint: Parameters<typeof handleReplayBatchCheckpoint>[0]) =>
      void handleReplayBatchCheckpoint(checkpoint),
    onReplayBatchStatus: handleReplayBatchStatus,
  }), [
    artifacts.drawingArtifactDescriptor,
    artifacts.solutionUrl,
    autoReplayRunning,
    effectiveDrawingUrl,
    frameEvents,
    frameNeedsInteractive,
    handleFrameReady,
    handleReplayBatchCheckpoint,
    handleReplayBatchStatus,
    handleVerifiedInteraction,
    isCreator,
    isSequenceRecording,
    replaySequence,
    sessionStepCaptureCacheKey,
    shouldBypassSelectedStepReplay,
    shouldShowInteractivePreview,
  ]);

  // ---- Render ----

  if (!level) return null;

  return (
    <ScenarioDrawingContext.Provider value={contextValue}>
      <ScenarioDrawing
        scenario={scenario}
        allowScaling={allowScaling}
        registerForNavbarCapture={registerForNavbarCapture}
        suppressHeavyLayoutEffects={suppressHeavyLayoutEffects}
      />
    </ScenarioDrawingContext.Provider>
  );
};
