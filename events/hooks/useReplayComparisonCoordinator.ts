"use client";

import { useCallback, useRef } from "react";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceAccuracyStore";
import {
  logArtboardReplayDebug,
  useArtboardReplayRuntimeStore,
  type ReplayBoardCapture,
  type ReplayComparisonResult,
  type ReplayStepToken,
} from "@/events/core/artboardReplayRuntimeStore";
import { useEventStepRuntimeStore } from "@/events/core/eventStepRuntimeStore";
import { loadImageData, runPixelComparison } from "@/lib/drawboard/pixelComparison";
type UseReplayComparisonCoordinatorParams = {
  runtimeKey: string;
  scenarioDimensions: { width: number; height: number };
};

type PairEntry = {
  drawing?: ReplayBoardCapture;
  solution?: ReplayBoardCapture;
  comparedAt?: number;
};

function pairKey(runId: number, stepId: string): string {
  return `${runId}:${stepId}`;
}

export function useReplayComparisonCoordinator({
  runtimeKey,
  scenarioDimensions,
}: UseReplayComparisonCoordinatorParams) {
  const pairsRef = useRef<Map<string, PairEntry>>(new Map());
  const compareInFlightRef = useRef<Set<string>>(new Set());

  const clearRun = useCallback((runId: number) => {
    const prefix = `${runId}:`;
    for (const key of pairsRef.current.keys()) {
      if (key.startsWith(prefix)) {
        pairsRef.current.delete(key);
      }
    }
    compareInFlightRef.current = new Set(
      Array.from(compareInFlightRef.current).filter((key) => !key.startsWith(prefix)),
    );
  }, []);

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
    const pair = pairsRef.current.get(key);
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
        runId: token.runId,
        stepId: token.stepId,
      };
      logArtboardReplayDebug("compare-result", {
        accuracy,
        diffLength: diff?.length ?? 0,
        drawingImageUrl: pair.drawing.imageUrl,
        runtimeKey,
        solutionImageUrl: pair.solution.imageUrl,
        stepId: token.stepId,
        runId: token.runId,
      });
      useArtboardReplayRuntimeStore.getState().setReplayComparisonResult(runtimeKey, result);
      useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, accuracy);
      useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, token.stepId, {
        accuracyRaw: accuracy,
        diffUrl: diff,
      });
      const current = pairsRef.current.get(key);
      if (current) {
        pairsRef.current.set(key, { ...current, comparedAt: result.comparedAt });
      }
    } catch (error) {
      console.error("useReplayComparisonCoordinator: failed to compare step pair", error);
      useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, -2);
    } finally {
      compareInFlightRef.current.delete(key);
    }
  }, [resolveCaptureImageData, runtimeKey]);

  const registerBoardCapture = useCallback((capture: ReplayBoardCapture) => {
    logArtboardReplayDebug("register-board-capture", {
      board: capture.board,
      imageUrl: capture.imageUrl,
      runtimeKey,
      stepId: capture.stepId,
      runId: capture.runId,
    });
    const key = pairKey(capture.runId, capture.stepId);
    const current = pairsRef.current.get(key) ?? {};
    pairsRef.current.set(key, { ...current, [capture.board]: capture });
    void maybeComparePair({ runId: capture.runId, stepId: capture.stepId });
  }, [maybeComparePair, runtimeKey]);

  return {
    clearRun,
    registerBoardCapture,
  };
}
