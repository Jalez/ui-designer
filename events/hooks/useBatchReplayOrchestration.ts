/**
 * useBatchReplayOrchestration — drives the requestReplayBatch → checkpoint → accuracy flow.
 *
 * Watches autoReplay.running and fires requestReplayBatch on the drawing frame.
 * Receives per-step checkpoint callbacks from Frame, compares each captured image
 * against the step solution, and writes accuracy scores to the sequence runtime.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import {
  clearSessionStepDrawingCaptures,
} from "@/lib/drawboard/drawboardPixelsStore";
import {
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  useEventSequenceStore,
  type AutoReplayState,
} from "@/events/core/eventSequenceState";
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
  autoReplay: AutoReplayState | null;
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
  autoReplay,
  stepPreviews,
  getStepSolutionUrl,
  drawboardCaptureMode,
  suppressSequenceMetrics,
}: UseBatchReplayOrchestrationParams): UseBatchReplayOrchestrationResult {
  const dispatch = useAppDispatch();
  const batchCheckpointIdsRef = useRef<Set<string>>(new Set());
  const requestedBatchRunIdRef = useRef<number | null>(null);
  const stepPreviewsRef = useRef(stepPreviews);
  useEffect(() => { stepPreviewsRef.current = stepPreviews; }, [stepPreviews]);

  // ---- Per-step pixel comparison ----

  const compareCapturedStep = useCallback(async (
    stepId: string,
    drawingData: ImageData,
  ): Promise<number | null> => {
    const { width, height } = scenarioDimensions;

    if (drawboardCaptureMode === "browser") {
      const targetImageUrl = getStepSolutionUrl(stepId);
      if (!targetImageUrl) return null;
      const targetData = await loadImageData(targetImageUrl, width, height);
      if (!targetData) return null;
      return (await runPixelComparison(drawingData, targetData)).accuracy;
    }

    // Non-browser: use server-rendered preview buffer
    const preview = stepPreviewsRef.current[stepId];
    if (!preview) return null;
    const targetData = imageDataFromScoringRgba(preview.pixelBufferBase64, preview.width, preview.height);
    if (!targetData) return null;
    return (await runPixelComparison(drawingData, targetData)).accuracy;
  }, [drawboardCaptureMode, getStepSolutionUrl, scenarioDimensions]);

  // ---- Restore step selection after batch ----

  const restoreOriginalSelectedStepAfterBatch = useCallback((runId: number) => {
    const store = useEventSequenceStore.getState();
    const runtimeState = store.getRuntimeState(runtimeKey);
    if (!runtimeState.autoReplay || runtimeState.autoReplay.runId !== runId) return;
    store.setSelectedStep(currentLevel, scenarioId, runtimeState.autoReplay.originalSelectedStepId);
    store.stopAutoReplay(runtimeKey);
  }, [currentLevel, runtimeKey, scenarioId]);

  // ---- Batch status callback ----

  const handleReplayBatchStatus = useCallback((event: ReplayBatchStatusEvent) => {
    const store = useEventSequenceStore.getState();
    const runtimeState = store.getRuntimeState(runtimeKey);
    if (!runtimeState.autoReplay || runtimeState.autoReplay.runId !== event.runId) return;

    if (event.status === "started") {
      requestedBatchRunIdRef.current = event.runId;
      batchCheckpointIdsRef.current = new Set();
      clearSessionStepDrawingCaptures(sessionStepCaptureCacheKey);
      store.updateRuntimeState(runtimeKey, (current) => ({
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
      store.setAutoReplayProgress(runtimeKey, batchVisibleStepIds.length, batchVisibleStepIds.length);
      restoreOriginalSelectedStepAfterBatch(event.runId);
      return;
    }
    if (event.status === "cancelled" || event.status === "failed") {
      store.updateRuntimeState(runtimeKey, (current) => {
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
    const store = useEventSequenceStore.getState();
    const runtimeState = store.getRuntimeState(runtimeKey);
    if (!runtimeState.autoReplay || runtimeState.autoReplay.runId !== checkpoint.runId) return;

    batchCheckpointIdsRef.current.add(checkpoint.stepId);
    store.setAutoReplayProgress(runtimeKey, batchCheckpointIdsRef.current.size, batchVisibleStepIds.length);
    if (
      checkpoint.stepId === INITIAL_EVENT_SEQUENCE_STEP_ID
      && runtimeState.replayJourney.totalSteps > 0
    ) {
      store.setReplayJourneyProgress(runtimeKey, 1, runtimeState.replayJourney.totalSteps);
    }

    try {
      const accuracy = await compareCapturedStep(checkpoint.stepId, checkpoint.imageData);
      store.updateRuntimeState(runtimeKey, (current) => ({
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
      store.updateRuntimeState(runtimeKey, (current) => ({
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

    if (!autoReplay?.running) {
      if (requestedBatchRunIdRef.current != null) {
        drawingFrameRef.current?.cancelReplayBatch(requestedBatchRunIdRef.current);
      }
      requestedBatchRunIdRef.current = null;
      return;
    }
    if (requestedBatchRunIdRef.current === autoReplay.runId) return;
    if (!drawingFrameRef.current) return;

    requestedBatchRunIdRef.current = autoReplay.runId;
    drawingFrameRef.current.requestReplayBatch({
      replaySequence: scenarioSequence,
      runId: autoReplay.runId,
      visibleStepIds: batchVisibleStepIds,
    });
  }, [
    autoReplay,
    batchVisibleStepIds,
    drawingFrameReadyVersion,
    drawingFrameRef,
    runtimeKey,
    scenarioId,
    scenarioSequence,
    suppressSequenceMetrics,
  ]);

  return { handleReplayBatchStatus, handleReplayBatchCheckpoint };
}
