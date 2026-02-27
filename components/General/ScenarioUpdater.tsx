'use client';

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { updateLevelAccuracyByIndexThunk } from "@/store/actions/score.actions";
import { addDifferenceUrl } from "@/store/slices/differenceUrls.slice";
import { getPixelData } from "@/lib/utils/imageTools/getPixelData";
import { batch } from "react-redux";
import { scenario } from "@/types";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export let scenarioDiffs = {};

type ScenarioUpdaterProps = {
  scenario: scenario;
  drawingPixels?: ImageData | undefined;
  solutionPixels?: ImageData | undefined;
  handleSolutionPixelUpdate: (scenarioId: string, pixels: ImageData) => void;
  handleDrawingPixelUpdate: (scenarioId: string, pixels: ImageData) => void;
};

export const ScenarioUpdater = ({
  scenario,
  drawingPixels,
  solutionPixels,
  handleSolutionPixelUpdate,
  handleDrawingPixelUpdate,
}: ScenarioUpdaterProps) => {
  const dispatch = useAppDispatch();
  const solutionUrls = useAppSelector((state) => state.solutionUrls);
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const currentLevelRef = useRef(currentLevel);
  currentLevelRef.current = currentLevel;
  const scenarioId = scenario.scenarioId;

  // Select only primitive dimension values to avoid reference-change re-renders
  const dimWidth = useAppSelector((state) => {
    const levelData = state.levels[state.currentLevel.currentLevel - 1];
    const found = levelData?.scenarios?.find((s) => s.scenarioId === scenario.scenarioId);
    return found?.dimensions?.width ?? scenario.dimensions.width;
  });
  const dimHeight = useAppSelector((state) => {
    const levelData = state.levels[state.currentLevel.currentLevel - 1];
    const found = levelData?.scenarios?.find((s) => s.scenarioId === scenario.scenarioId);
    return found?.dimensions?.height ?? scenario.dimensions.height;
  });

  useEffect(() => {
    const solutionUrl = solutionUrls[scenario.scenarioId];

    if (!solutionUrl || solutionPixels) {
      return;
    }

    const img = new Image();
    img.onerror = (e) => {
      console.error("ScenarioUpdater: Failed to load solution image", e);
    };
    img.src = solutionUrl;
    img.onload = () => {
      const imageData = getPixelData(img, dimWidth, dimHeight);
      handleSolutionPixelUpdate(scenario.scenarioId, imageData);
    };
  }, [solutionUrls, dimWidth, dimHeight, solutionPixels, handleSolutionPixelUpdate, scenario.scenarioId]);

  const workerRunningRef = useRef(false);

  useEffect(() => {
    if (!drawingPixels || !solutionPixels) {
      return;
    }

    // Debounce: wait 300ms after the last pixel update before spawning worker
    // This prevents spawning a worker on every individual keystroke
    const debounceTimer = setTimeout(() => {
      if (workerRunningRef.current) {
        return;
      }

      let worker: Worker | null = null;

      try {
        worker = new Worker(
          new URL('../../lib/utils/workers/imageComparisonWorker.ts', import.meta.url),
          { type: 'module' }
        );

        workerRunningRef.current = true;

        worker.onmessage = ({ data }) => {
          const { accuracy, diff } = data;
          workerRunningRef.current = false;

          if (!diff) {
            return;
          }

          const levelIndex = currentLevelRef.current - 1;
          batch(() => {
            dispatch(
              updateLevelAccuracyByIndexThunk(levelIndex, scenarioId, accuracy)
            );
            dispatch(
              addDifferenceUrl({
                scenarioId: scenarioId,
                differenceUrl: diff,
              })
            );
          });
          if (worker) {
            worker.terminate();
          }
        };

        worker.onerror = (error) => {
          console.error("ScenarioUpdater: Worker error:", error);
          workerRunningRef.current = false;
          if (worker) {
            worker.terminate();
          }
        };

        // Copy buffers before transferring
        const drawingBuffer = drawingPixels.data.buffer.slice(0);
        const solutionBuffer = solutionPixels.data.buffer.slice(0);

        worker.postMessage(
          {
            drawingBuffer: drawingBuffer,
            solutionBuffer: solutionBuffer,
            width: drawingPixels.width,
            height: drawingPixels.height,
          },
          [drawingBuffer, solutionBuffer]
        );
      } catch (error) {
        console.error("ScenarioUpdater: Failed to create worker:", error);
        workerRunningRef.current = false;
      }
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingPixels, solutionPixels, dispatch, scenarioId]);

  return <></>;
};
