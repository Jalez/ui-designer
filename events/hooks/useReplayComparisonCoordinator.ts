"use client";

import { useCallback, useRef } from "react";
import { addDifferenceUrl } from "@/store/slices/differenceUrls.slice";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceAccuracyStore";
import {
  getReplayComparisonResult,
  logArtboardReplayDebug,
  useArtboardReplayRuntimeStore,
  type ReplayBoardCapture,
  type ReplayComparisonResult,
  type ReplayStepToken,
} from "@/events/core/artboardReplayRuntimeStore";
import { eventSequenceDiffStorageKey } from "@/events/core/eventSequenceDiffUrls";
import { loadImageData, runPixelComparison } from "@/lib/drawboard/pixelComparison";
import type { AppDispatch } from "@/store/store";

type UseReplayComparisonCoordinatorParams = {
  dispatch: AppDispatch;
  runtimeKey: string;
  scenarioDimensions: { width: number; height: number };
  scenarioId: string;
};

function pairKey(runId: number, stepId: string): string {
  return `${runId}:${stepId}`;
}

export function useReplayComparisonCoordinator({
  dispatch,
  runtimeKey,
  scenarioDimensions,
  scenarioId,
}: UseReplayComparisonCoordinatorParams) {
  const compareInFlightRef = useRef<Set<string>>(new Set());

  const clearRun = useCallback((runId: number) => {
    useArtboardReplayRuntimeStore.getState().clearRun(runtimeKey, runId);
    compareInFlightRef.current = new Set(Array.from(compareInFlightRef.current).filter((key) => !key.startsWith(`${runId}:`)));
  }, [runtimeKey]);

  const resolveCaptureImageData = useCallback(async (capture: ReplayBoardCapture): Promise<ImageData | null> => {
    if (capture.imageData) {
      return capture.imageData;
    }
    return loadImageData(
      capture.imageUrl,
      scenarioDimensions.width,
      scenarioDimensions.height,
    );
  }, [scenarioDimensions.height, scenarioDimensions.width]);

  const maybeComparePair = useCallback(async (token: ReplayStepToken) => {
    const key = pairKey(token.runId, token.stepId);
    const pair = useArtboardReplayRuntimeStore.getState().pairsByKey[runtimeKey]?.[key];
    if (!pair?.drawing || !pair.solution || pair.comparedAt || compareInFlightRef.current.has(key)) {
      logArtboardReplayDebug("compare-skip", {
        hasComparedAt: Boolean(pair?.comparedAt),
        hasDrawing: Boolean(pair?.drawing),
        hasSolution: Boolean(pair?.solution),
        inFlight: compareInFlightRef.current.has(key),
        runtimeKey,
        stepId: token.stepId,
        runId: token.runId,
      });
      return;
    }

    compareInFlightRef.current.add(key);
    try {
      const [drawingData, solutionData] = await Promise.all([
        resolveCaptureImageData(pair.drawing),
        resolveCaptureImageData(pair.solution),
      ]);
      if (!drawingData || !solutionData) {
        logArtboardReplayDebug("compare-missing-image-data", {
          drawingImageUrl: pair.drawing.imageUrl,
          hasDrawingData: Boolean(drawingData),
          hasSolutionData: Boolean(solutionData),
          runtimeKey,
          solutionImageUrl: pair.solution.imageUrl,
          stepId: token.stepId,
          runId: token.runId,
        });
        useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, -2);
        return;
      }
      const { accuracy, diff } = await runPixelComparison(drawingData, solutionData);
      const result: ReplayComparisonResult = {
        accuracy,
        comparedAt: Date.now(),
        diff,
        drawingFingerprint: pair.drawing.fingerprint,
        runId: token.runId,
        stepId: token.stepId,
        solutionFingerprint: pair.solution.fingerprint,
      };
      logArtboardReplayDebug("compare-result", {
        accuracy,
        diffLength: diff?.length ?? 0,
        drawingFingerprint: result.drawingFingerprint,
        drawingImageUrl: pair.drawing.imageUrl,
        runtimeKey,
        solutionFingerprint: result.solutionFingerprint,
        solutionImageUrl: pair.solution.imageUrl,
        stepId: token.stepId,
        runId: token.runId,
      });
      useArtboardReplayRuntimeStore.getState().setReplayComparisonResult(runtimeKey, result);
      useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, accuracy);
      if (diff) {
        dispatch(addDifferenceUrl({
          differenceUrl: diff,
          eventSequenceStepId: token.stepId,
          scenarioId,
          storageKey: eventSequenceDiffStorageKey(scenarioId, token.stepId),
        }));
      }
      const current = useArtboardReplayRuntimeStore.getState().pairsByKey[runtimeKey]?.[key];
      if (current) {
        useArtboardReplayRuntimeStore.setState((state) => ({
          pairsByKey: {
            ...state.pairsByKey,
            [runtimeKey]: {
              ...(state.pairsByKey[runtimeKey] ?? {}),
              [key]: { ...current, comparedAt: result.comparedAt },
            },
          },
        }));
      }
    } catch (error) {
      console.error("useReplayComparisonCoordinator: failed to compare step pair", error);
      useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, -2);
    } finally {
      compareInFlightRef.current.delete(key);
    }
  }, [dispatch, resolveCaptureImageData, runtimeKey, scenarioId]);

  const registerBoardCapture = useCallback((capture: ReplayBoardCapture) => {
    logArtboardReplayDebug("register-board-capture", {
      board: capture.board,
      fingerprint: capture.fingerprint,
      imageUrl: capture.imageUrl,
      runtimeKey,
      stepId: capture.stepId,
      runId: capture.runId,
    });
    useArtboardReplayRuntimeStore.getState().registerBoardCapture(runtimeKey, capture);
    void maybeComparePair({ runId: capture.runId, stepId: capture.stepId });
  }, [maybeComparePair, runtimeKey]);

  return {
    clearRun,
    getReplayComparisonResult: (runId: number, stepId: string) => getReplayComparisonResult(runtimeKey, runId, stepId),
    registerBoardCapture,
  };
}
