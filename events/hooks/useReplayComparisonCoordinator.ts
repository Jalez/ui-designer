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
  onComparisonSettled?: (token: ReplayStepToken) => void;
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
  onComparisonSettled,
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
    const drawingCapture = pair.drawing;
    const solutionCapture = pair.solution;
    try {
      const [drawingData, solutionData] = await Promise.all([
        resolveCaptureImageData(drawingCapture),
        resolveCaptureImageData(solutionCapture),
      ]);
      const latestPair = pairsRef.current.get(key);
      if (latestPair?.drawing !== drawingCapture || latestPair?.solution !== solutionCapture) {
        return;
      }
      if (!drawingData || !solutionData) {
        logArtboardReplayDebug("compare-missing-image-data", {
          drawingImageUrl: drawingCapture.imageUrl,
          hasDrawingData: Boolean(drawingData),
          hasSolutionData: Boolean(solutionData),
          runtimeKey,
          solutionImageUrl: solutionCapture.imageUrl,
          stepId: token.stepId,
          runId: token.runId,
        });
        useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, -2);
        const current = pairsRef.current.get(key);
        if (current) {
          pairsRef.current.set(key, { ...current, comparedAt: Date.now() });
        }
        onComparisonSettled?.(token);
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
        drawingImageUrl: drawingCapture.imageUrl,
        runtimeKey,
        solutionImageUrl: solutionCapture.imageUrl,
        stepId: token.stepId,
        runId: token.runId,
      });
      useArtboardReplayRuntimeStore.getState().setReplayComparisonResult(runtimeKey, result);
      useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, accuracy);
      useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, token.stepId, {
        accuracyRaw: accuracy,
        diffUrl: diff,
      });
      onComparisonSettled?.(token);
      const current = pairsRef.current.get(key);
      if (current) {
        pairsRef.current.set(key, { ...current, comparedAt: result.comparedAt });
      }
    } catch (error) {
      console.error("useReplayComparisonCoordinator: failed to compare step pair", error);
      useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, token.stepId, -2);
      const current = pairsRef.current.get(key);
      if (current) {
        pairsRef.current.set(key, { ...current, comparedAt: Date.now() });
      }
      onComparisonSettled?.(token);
    } finally {
      compareInFlightRef.current.delete(key);
      const latestPair = pairsRef.current.get(key);
      if (
        latestPair?.drawing
        && latestPair.solution
        && !latestPair.comparedAt
      ) {
        void maybeComparePair(token);
      }
    }
  }, [onComparisonSettled, resolveCaptureImageData, runtimeKey]);

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
    pairsRef.current.set(key, { ...current, [capture.board]: capture, comparedAt: undefined });
    void maybeComparePair({ runId: capture.runId, stepId: capture.stepId });
  }, [maybeComparePair, runtimeKey]);

  return {
    clearRun,
    registerBoardCapture,
  };
}
