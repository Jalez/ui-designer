/**
 * useBatchReplayOrchestration — drives the requestReplayBatch → checkpoint → accuracy flow.
 *
 * Watches `useEventSequenceRunStore` `isRunning` + `replayBatchSession` and fires requestReplayBatch on the drawing frame.
 * Receives per-step checkpoint callbacks from Frame, compares each captured image
 * against the step solution, and writes accuracy scores to the sequence runtime.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector, useAppStore } from "@/store/hooks/hooks";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import {
  clearSessionStepDrawingCaptures,
  getSessionStepDrawingCapture,
} from "@/lib/drawboard/drawboardPixelsStore";
import {
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  type ReplayBatchSessionState,
} from "@/events/core/eventSequenceReplayTypes";
import { endReplayBatch } from "@/events/core/eventSequenceFacades";
import { useBrowserSolutionPreflightStore } from "@/events/core/browserSolutionPreflightStore";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceCaptureStore";
import { loadImageData, runPixelComparison } from "@/lib/drawboard/pixelComparison";
import { imageDataFromScoringRgba, type DrawboardRenderPreviewPayload } from "@/events/core/imageUtils";
import type { ReplayBatchCheckpoint, ReplayBatchStatusEvent } from "@/components/ArtBoards/Frame";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import type { EventSequenceStep } from "@/types";
import React from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UseBatchReplayOrchestrationParams = {
  drawingFrameRef: React.RefObject<FrameHandle | null>;
  drawingFrameReadyVersion: number;
  runtimeKey: string;
  currentLevel: number;
  scenarioId: string;
  scenarioDimensions: { width: number; height: number };
  scenarioSequence: EventSequenceStep[];
  batchVisibleStepIds: string[];
  sessionStepCaptureCacheKey: string;
  currentDrawingStepId: string;
  drawingArtifactKey: string;
  replayBatchSession: ReplayBatchSessionState | null;
  /** Server-rendered per-step solution previews (non-browser mode comparison target). */
  stepPreviews: Record<string, DrawboardRenderPreviewPayload>;
  /** Resolves the step solution URL from Redux (browser mode comparison target). */
  getStepSolutionUrl: (stepId: string) => string;
  drawboardCaptureMode: string;
  suppressSequenceMetrics: boolean;
};

export type UseBatchReplayOrchestrationResult = {
  handleReplayBatchStatus: (event: ReplayBatchStatusEvent) => void;
  handleReplayBatchCheckpoint: (checkpoint: ReplayBatchCheckpoint) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBatchReplayOrchestration({
  drawingFrameRef,
  drawingFrameReadyVersion,
  runtimeKey,
  currentLevel,
  scenarioId,
  scenarioDimensions,
  scenarioSequence,
  batchVisibleStepIds,
  sessionStepCaptureCacheKey,
  currentDrawingStepId,
  drawingArtifactKey,
  replayBatchSession,
  stepPreviews,
  getStepSolutionUrl,
  drawboardCaptureMode,
  suppressSequenceMetrics,
}: UseBatchReplayOrchestrationParams): UseBatchReplayOrchestrationResult {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const eventSequenceRunActive = useSequenceReplayStore((state) => state.isRunning);
  const batchCheckpointIdsRef = useRef<Set<string>>(new Set());
  const requestedBatchRunIdRef = useRef<number | null>(null);
  const stepPreviewsRef = useRef(stepPreviews);
  useEffect(() => { stepPreviewsRef.current = stepPreviews; }, [stepPreviews]);

  /** Wait for Redux solution URL (live iframe / prewarm) without polling timers — store-driven. */
  const waitForBrowserStepSolutionUrl = useCallback((
    stepId: string,
    runId: number,
  ): Promise<string | null> => {
    const immediate = getStepSolutionUrl(stepId)?.trim();
    if (immediate) return Promise.resolve(immediate);
    return new Promise((resolve) => {
      const tryResolve = () => {
        const batch = useSequenceReplayStore.getState().getBatch(runtimeKey);
        // Batch cleared after *completion* must NOT abort the wait — URLs often land just after.
        // Only cancel when a *different* run is active (superseded).
        if (batch && batch.runId !== runId) {
          cleanup();
          resolve(null);
          return;
        }
        const url = getStepSolutionUrl(stepId)?.trim();
        if (url) {
          cleanup();
          resolve(url);
        }
      };
      const unsubscribe = store.subscribe(tryResolve);
      function cleanup() {
        unsubscribe();
      }
      tryResolve();
    });
  }, [getStepSolutionUrl, runtimeKey, store]);

  // ---- Per-step pixel comparison ----

  const compareCapturedStep = useCallback(async (
    stepId: string,
    drawingData: ImageData,
  ): Promise<number | null> => {
    const { width, height } = scenarioDimensions;

    if (drawboardCaptureMode === "browser") {
      let targetImageUrl = getStepSolutionUrl(stepId)?.trim() ?? "";
      if (!targetImageUrl && replayBatchSession) {
        const runner = useBrowserSolutionPreflightStore.getState().getRunner(runtimeKey);
        const captured = runner ? await runner(stepId) : null;
        targetImageUrl = captured?.trim() ?? "";
      }
      if (!targetImageUrl && replayBatchSession) {
        const waited = await waitForBrowserStepSolutionUrl(stepId, replayBatchSession.runId);
        targetImageUrl = waited?.trim() ?? "";
      }
      // #region agent log
      fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',hypothesisId:'H18,H19,H21',location:'useBatchReplayOrchestration.ts:compareCapturedStep:browser',message:'path B browser branch',data:{stepId,drawingW:drawingData.width,drawingH:drawingData.height,scenarioW:width,scenarioH:height,hasTargetUrl:Boolean(targetImageUrl),targetUrlHead:targetImageUrl?targetImageUrl.slice(0,120):null,targetUrlLen:targetImageUrl?targetImageUrl.length:0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!targetImageUrl.trim()) return null;
      const targetData = await loadImageData(targetImageUrl, width, height);
      if (!targetData) return null;
      const acc = (await runPixelComparison(drawingData, targetData)).accuracy;
      // #region agent log
      fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',hypothesisId:'H18,H19,H21',location:'useBatchReplayOrchestration.ts:compareCapturedStep:browserResult',message:'path B browser accuracy',data:{stepId,accuracy:acc,drawingW:drawingData.width,drawingH:drawingData.height,targetW:targetData.width,targetH:targetData.height},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return acc;
    }

    // Non-browser: use server-rendered preview buffer
    const preview = stepPreviewsRef.current[stepId];
    if (!preview) return null;
    const targetData = imageDataFromScoringRgba(preview.pixelBufferBase64, preview.width, preview.height);
    if (!targetData) return null;
    const acc = (await runPixelComparison(drawingData, targetData)).accuracy;
    // #region agent log
    fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',hypothesisId:'H18,H19,H21',location:'useBatchReplayOrchestration.ts:compareCapturedStep:preview',message:'path B server-preview branch',data:{stepId,accuracy:acc,drawingW:drawingData.width,drawingH:drawingData.height,targetW:targetData.width,targetH:targetData.height},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return acc;
  }, [drawboardCaptureMode, getStepSolutionUrl, replayBatchSession, runtimeKey, scenarioDimensions, waitForBrowserStepSolutionUrl]);

  // ---- Restore step selection after batch ----

  const restoreOriginalSelectedStepAfterBatch = useCallback((runId: number) => {
    const batch = useSequenceReplayStore.getState().getBatch(runtimeKey);
    if (!batch || batch.runId !== runId) return;
    useEventSequenceTimelineUiStore.getState().setSelectedStep(
      currentLevel,
      scenarioId,
      batch.originalSelectedStepId,
    );
    endReplayBatch(runtimeKey);
  }, [currentLevel, runtimeKey, scenarioId]);

  // ---- Batch status callback ----

  const handleReplayBatchStatus = useCallback((event: ReplayBatchStatusEvent) => {
    const batch = useSequenceReplayStore.getState().getBatch(runtimeKey);
    if (!batch || batch.runId !== event.runId) return;

    if (event.status === "started") {
      requestedBatchRunIdRef.current = event.runId;
      batchCheckpointIdsRef.current = new Set();
      clearSessionStepDrawingCaptures(sessionStepCaptureCacheKey);
      useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => ({
        ...current,
        stepAccuraciesByStepId: Object.fromEntries(
          batchVisibleStepIds.map((stepId) => [
            stepId,
            { accuracy: -1, version: current.drawingVersion },
          ] as const),
        ),
      }));
      return;
    }
    if (event.status === "completed") {
      useSequenceReplayStore.getState().setBatchProgress(
        runtimeKey,
        batchVisibleStepIds.length,
        batchVisibleStepIds.length,
      );
      restoreOriginalSelectedStepAfterBatch(event.runId);
      return;
    }
    if (event.status === "cancelled" || event.status === "failed") {
      useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => {
        const nextAccuracies = { ...current.stepAccuraciesByStepId };
        batchVisibleStepIds.forEach((stepId) => {
          if (!batchCheckpointIdsRef.current.has(stepId) && nextAccuracies[stepId]?.accuracy === -1) {
            nextAccuracies[stepId] = {
              accuracy: -2,
              version: current.drawingVersion,
            };
          }
        });
        return { ...current, stepAccuraciesByStepId: nextAccuracies };
      });
      restoreOriginalSelectedStepAfterBatch(event.runId);
    }
  }, [batchVisibleStepIds, restoreOriginalSelectedStepAfterBatch, runtimeKey, sessionStepCaptureCacheKey]);

  // ---- Batch checkpoint callback ----

  const handleReplayBatchCheckpoint = useCallback(async (checkpoint: ReplayBatchCheckpoint) => {
    const replayState = useSequenceReplayStore.getState();
    const batch = replayState.getBatch(runtimeKey);
    if (!batch || batch.runId !== checkpoint.runId) return;

    batchCheckpointIdsRef.current.add(checkpoint.stepId);
    replayState.setBatchProgress(
      runtimeKey,
      batchCheckpointIdsRef.current.size,
      batchVisibleStepIds.length,
    );
    const journey = replayState.getJourney(runtimeKey);
    if (checkpoint.stepId === INITIAL_EVENT_SEQUENCE_STEP_ID && journey.totalSteps > 0) {
      replayState.setJourneyProgress(runtimeKey, 1, journey.totalSteps);
    }

    try {
      const accuracy = await compareCapturedStep(checkpoint.stepId, checkpoint.imageData);
      useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => ({
        ...current,
        stepAccuraciesByStepId: {
          ...current.stepAccuraciesByStepId,
          [checkpoint.stepId]: {
            accuracy: accuracy ?? -2,
            version: current.drawingVersion,
          },
        },
      }));
      if (checkpoint.stepId === currentDrawingStepId) {
        dispatch(addDrawingUrl({
          drawingUrl: checkpoint.dataUrl,
          scenarioId,
          storageKey: drawingArtifactKey,
        }));
      }
    } catch (error) {
      console.error("useBatchReplayOrchestration: failed to compare checkpoint", error);
      useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => ({
        ...current,
        stepAccuraciesByStepId: {
          ...current.stepAccuraciesByStepId,
          [checkpoint.stepId]: {
            accuracy: -2,
            version: current.drawingVersion,
          },
        },
      }));
    }
  }, [
    batchVisibleStepIds.length,
    compareCapturedStep,
    currentDrawingStepId,
    dispatch,
    drawingArtifactKey,
    runtimeKey,
    scenarioId,
  ]);

  // ---- Batch request dispatch effect ----

  useEffect(() => {
    if (suppressSequenceMetrics || !scenarioSequence.length) return;

    if (!eventSequenceRunActive || !replayBatchSession) {
      if (requestedBatchRunIdRef.current != null) {
        drawingFrameRef.current?.cancelReplayBatch(requestedBatchRunIdRef.current);
      }
      requestedBatchRunIdRef.current = null;
      return;
    }
    if (requestedBatchRunIdRef.current === replayBatchSession.runId) return;
    if (!drawingFrameRef.current) return;

    requestedBatchRunIdRef.current = replayBatchSession.runId;
    drawingFrameRef.current.requestReplayBatch({
      replaySequence: scenarioSequence,
      runId: replayBatchSession.runId,
      visibleStepIds: batchVisibleStepIds,
    });
  }, [
    eventSequenceRunActive,
    replayBatchSession,
    batchVisibleStepIds,
    drawingFrameReadyVersion,
    drawingFrameRef,
    runtimeKey,
    scenarioId,
    scenarioSequence,
    suppressSequenceMetrics,
  ]);

  // ---- Re-run Path B when a step's solution URL is upgraded (e.g. by the live
  // solution iframe overwriting a server-rendered step-preview URL). Ensures the
  // displayed batch-replay accuracy reflects the same pixels Path A compares against.
  const solutionUrlsMap = useAppSelector(
    (state) => (state as { solutionUrls: Record<string, string | undefined> }).solutionUrls,
  );
  const lastSolutionUrlByStepRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (drawboardCaptureMode !== "browser") return;
    if (batchVisibleStepIds.length === 0) return;

    for (const stepId of batchVisibleStepIds) {
      const currentUrl = getStepSolutionUrl(stepId);
      const prevUrl = lastSolutionUrlByStepRef.current[stepId];
      lastSolutionUrlByStepRef.current[stepId] = currentUrl;

      // Establish empty baseline without re-comparing; allow first non-empty URL to trigger.
      if (prevUrl === undefined && !currentUrl?.trim()) continue;
      if (prevUrl === currentUrl) continue;
      if (!currentUrl?.trim()) continue;

      const capture = getSessionStepDrawingCapture(sessionStepCaptureCacheKey, stepId);
      if (!capture) continue;

      // #region agent log
      fetch('http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4fd055'},body:JSON.stringify({sessionId:'4fd055',runId:'post-fix-h28',hypothesisId:'H28',location:'useBatchReplayOrchestration.ts:solutionUrlChange:rerun',message:'re-running path B after solution URL upgrade',data:{stepId,prevUrlLen:prevUrl?.length ?? 0,newUrlLen:currentUrl.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      void compareCapturedStep(stepId, capture.imageData).then((accuracy) => {
        useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => ({
          ...current,
          stepAccuraciesByStepId: {
            ...current.stepAccuraciesByStepId,
            [stepId]: {
              accuracy: accuracy ?? -2,
              version: current.drawingVersion,
            },
          },
        }));
      }).catch((error) => {
        console.error("useBatchReplayOrchestration: re-comparison failed", error);
      });
    }
  }, [
    solutionUrlsMap,
    batchVisibleStepIds,
    compareCapturedStep,
    drawboardCaptureMode,
    getStepSolutionUrl,
    runtimeKey,
    sessionStepCaptureCacheKey,
  ]);

  return { handleReplayBatchStatus, handleReplayBatchCheckpoint };
}
