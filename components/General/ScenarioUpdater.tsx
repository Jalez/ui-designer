'use client';

import { useEffect, useReducer, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { updateLevelAccuracyByIndexThunk } from "@/store/actions/score.actions";
import { addDifferenceUrl } from "@/store/slices/differenceUrls.slice";
import { batch } from "react-redux";
import { scenario } from "@/types";
import { runPixelComparison } from "@/lib/drawboard/pixelComparison";
import {
  getDrawboardPixelsPair,
  getDrawboardPixelsSideSerials,
  notifyStepAccuracyResult,
  subscribeDrawboardPixelsForScenario,
} from "@/lib/drawboard/drawboardPixelsStore";

type ScenarioUpdaterProps = {
  scenario: scenario;
  runtimeKey: string;
  differenceStepId?: string | null;
};

export const ScenarioUpdater = ({
  scenario,
  runtimeKey,
  differenceStepId,
}: ScenarioUpdaterProps) => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const currentLevelRef = useRef(currentLevel);
  const scenarioId = scenario.scenarioId;
  const [pixelsVersion, bumpPixelsVersion] = useReducer((value) => value + 1, 0);

  const workerRunningRef = useRef(false);
  // Stores the most-recent comparison to run once the current worker finishes.
  // Overwritten on each new pixel update so only the latest pending runs (no queue buildup).
  const retryPendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    currentLevelRef.current = currentLevel;
  }, [currentLevel]);

  useEffect(() => (
    subscribeDrawboardPixelsForScenario(runtimeKey, () => {
      bumpPixelsVersion();
    })
  ), [runtimeKey]);

  useEffect(() => {
    const { drawing: drawingPixels, solution: solutionPixels } = getDrawboardPixelsPair(runtimeKey);
    if (!drawingPixels || !solutionPixels) {
      return;
    }

    // Capture current pixels and stepId in this effect invocation's closure.
    const capturedDrawing = drawingPixels;
    const capturedSolution = solutionPixels;
    const capturedStepId = differenceStepId ?? null;

    const runComparison = () => {
      workerRunningRef.current = true;
      retryPendingRef.current = null;
      const sideSerials = getDrawboardPixelsSideSerials(runtimeKey);

      runPixelComparison(capturedDrawing, capturedSolution)
        .then(({ accuracy, diff }) => {
          workerRunningRef.current = false;

          notifyStepAccuracyResult(runtimeKey, capturedStepId, accuracy, sideSerials);

          if (diff) {
            const levelIndex = currentLevelRef.current - 1;
            batch(() => {
              // Event-sequence mode: footer mean comes from aggregated step scores (useStepAccuracyEngine).
              // Do not push single-step accuracy here — it overwrites the true mean.
              if (capturedStepId == null) {
                dispatch(
                  updateLevelAccuracyByIndexThunk(levelIndex, scenarioId, accuracy),
                );
              }
              dispatch(
                addDifferenceUrl({
                  scenarioId,
                  differenceUrl: diff,
                  eventSequenceStepId: capturedStepId ?? undefined,
                }),
              );
            });
          }

          // If newer pixels arrived while the worker was running, run one more comparison.
          const retry = retryPendingRef.current;
          if (retry) retry();
        })
        .catch((error) => {
          console.error("ScenarioUpdater: Worker error:", error);
          workerRunningRef.current = false;
          retryPendingRef.current = null;
        });
    };

    // Debounce: wait 300ms after the last pixel update before running comparison.
    // This prevents spawning a worker on every individual keystroke.
    const debounceTimer = setTimeout(() => {
      if (workerRunningRef.current) {
        // Worker busy — store this comparison as the pending retry (overwrites any older pending).
        retryPendingRef.current = runComparison;
        return;
      }
      runComparison();
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [differenceStepId, dispatch, pixelsVersion, runtimeKey, scenarioId]);

  return <></>;
};
