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
import { useAppDispatch, useAppStore } from "@/store/hooks/hooks";
import { useLevelContext } from "@/components/ArtBoards/LevelContext";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { ScenarioDrawing } from "@/components/ArtBoards/Drawboard/ScenarioDrawing";
import {
  buildArtifactKey,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import {
  getEventSequenceScenarioUiKey,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
} from "@/events/core/eventSequenceReplayTypes";
import {
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "@/events/core/eventSequenceCaptureStore";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceRecordingStore } from "@/events/core/eventSequenceRecordingStore";
import { useEventSequenceGameProgressStore } from "@/events/core/eventSequenceGameProgressStore";
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
  selectedEventSequenceStepId?: string | null;
  gameplaySolutionStepId?: string | null;
  /** Controlled prewarm step (ArtBoards). Omit with `onSolutionStepPrewarmChange` for DrawBoard-only internal state. */
  solutionStepPrewarmOverride?: string | null;
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
  selectedEventSequenceStepId,
  gameplaySolutionStepId = null,
  solutionStepPrewarmOverride,
  eventSequenceScopedTriggers = false,
}: EventsBoundScenarioDrawingProps): React.ReactNode => {
  const { currentLevel, drawboardCaptureMode, isCreatorContext, level } = useLevelContext();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const isCreator = isCreatorContext;
  const browserSolutionStepOverride = solutionStepPrewarmOverride ?? null;

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
    () => getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId),
    [currentLevel, scenario.scenarioId],
  );
  const sequenceCapture = useEventSequenceCaptureStore((state) => (
    selectCaptureState(state.captureByKey, runtimeKey)
  ));
  const eventSequenceRunActive = useSequenceReplayStore((state) => state.isRunning);
  const replayBatchSession = useSequenceReplayStore(
    (state) => state.batchByKey[runtimeKey] ?? null,
  );
  const recordingMode = useEventSequenceRecordingStore(
    (state) => state.recordingModeByKey[runtimeKey] ?? "idle",
  );
  const activeIndex = useEventSequenceGameProgressStore(
    (state) => state.activeIndexByKey[runtimeKey] ?? 0,
  );
  const normalizedActiveIndex = activeIndex >= scenarioSequence.length ? 0 : activeIndex;
  const gameplayActiveSequenceStep = scenarioSequence[normalizedActiveIndex] ?? null;
  const autoReplayRunning = eventSequenceRunActive && Boolean(replayBatchSession);
  const maskedSolutionStepIdOverride = autoReplayRunning ? null : browserSolutionStepOverride;

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',runId:'race-instr',hypothesisId:'H33',location:'EventsBoundScenarioDrawing.tsx:maskDecision:drawing',message:'mask decision for drawing board override',data:{autoReplayRunning,eventSequenceRunActive,hasBatchSession:Boolean(replayBatchSession),browserSolutionStepOverride,maskedSolutionStepIdOverride,selectedEventSequenceStepId,scenarioId:scenario.scenarioId},timestamp:Date.now()})}).catch(()=>{});
  }, [autoReplayRunning, eventSequenceRunActive, replayBatchSession, browserSolutionStepOverride, maskedSolutionStepIdOverride, selectedEventSequenceStepId, scenario.scenarioId]);

  useEffect(() => {
    fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',runId:'race-instr',hypothesisId:'H33',location:'EventsBoundScenarioDrawing.tsx:overrideCommit',message:'browserSolutionStepOverride committed',data:{browserSolutionStepOverride,autoReplayRunning,scenarioId:scenario.scenarioId},timestamp:Date.now()})}).catch(()=>{});
  }, [browserSolutionStepOverride, autoReplayRunning, scenario.scenarioId]);
  // #endregion

  // ---- Hook 1: Artifact resolution ----

  const artifacts = useScenarioArtifacts({
    scenario,
    isCreator,
    selectedEventSequenceStepId,
    gameplaySolutionStepId,
    // During batch replay, gameplay drives the solution iframe; keep prewarm state in parent so
    // capture can resume after replay (do not clear override in the prewarm effect).
    solutionStepIdOverride: maskedSolutionStepIdOverride,
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
    recordingMode,
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
    sequenceRuntime: { activeIndex, recordingMode },
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
    const key = buildArtifactKey(descriptor);
    const existing = (
      (store.getState() as { solutionUrls: Record<string, string | undefined> }).solutionUrls[key] ?? ""
    );
    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',runId:'post-fix-h26',hypothesisId:'H26',location:'EventsBoundScenarioDrawing.tsx:handleStepRendered:guard',message:'step-preview dispatch gate',data:{stepId,key,hadExisting:Boolean(existing.trim()),existingLen:existing.length,incomingLen:dataUrl.length,skipped:Boolean(existing.trim())},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (existing.trim()) {
      return;
    }
    dispatch(addSolutionUrl({
      solutionUrl: dataUrl,
      scenarioId: scenario.scenarioId,
      storageKey: key,
      eventSequenceStepId: stepId,
    }));
  }, [dispatch, scenario.scenarioId, store]);

  // Playwright (server) step previews must only run when capture mode is "playwright".
  // In browser mode, step solution images are produced by the live solution iframe
  // (`domToPng` inside the drawboard) and reach Redux via `addSolutionUrl` from Frame.tsx;
  // invoking the server renderer here would publish pixel-different images into the same
  // Redux slice, breaking Path B batch-replay accuracy until the user clicks each step.
  const isServerCaptureMode = drawboardCaptureMode === "playwright";
  const { stepPreviews } = useStepPreviewRenderer({
    scenarioSequence,
    scenarioId: scenario.scenarioId,
    resolvedSolutionCss: artifacts.resolvedSolutionCss,
    resolvedSolutionHtml: artifacts.resolvedSolutionHtml,
    solutionFingerprint: artifacts.solutionFingerprint,
    buildDescriptor: artifacts.buildDescriptor,
    suppressSequenceMetrics: suppressHeavyLayoutEffects || !isServerCaptureMode,
    onStepRendered: handleStepRendered,
  });

  // ---- Session step capture tracking (effectiveDrawingUrl) ----

  const sessionStepCaptureCacheKey = useMemo(
    () => `${runtimeKey}:${drawboardCaptureMode}:${artifacts.drawingArtifactDescriptor.fingerprint}:${sequenceCapture.drawingVersion}`,
    [artifacts.drawingArtifactDescriptor.fingerprint, drawboardCaptureMode, runtimeKey, sequenceCapture.drawingVersion],
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
    replayBatchSession,
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
    currentDrawingStepId,
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
    currentDrawingStepId,
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
