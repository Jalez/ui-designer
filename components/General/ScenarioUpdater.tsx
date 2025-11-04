'use client';

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { updateLevelAccuracyThunk } from "@/store/actions/score.actions";
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
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const scenarioId = scenario.scenarioId;

  useEffect(() => {
    const solutionUrl = solutionUrls[scenario.scenarioId];
    console.log("ScenarioUpdater: Checking solution URL", { scenarioId: scenario.scenarioId, hasSolutionUrl: !!solutionUrl, hasSolutionPixels: !!solutionPixels });
    
    if (!solutionUrl || solutionPixels) {
      if (!solutionUrl) {
        console.log("ScenarioUpdater: No solution URL yet for", scenario.scenarioId);
      }
      return;
    }

    console.log("ScenarioUpdater: Loading solution image", { scenarioId: scenario.scenarioId, url: solutionUrl.substring(0, 50) + '...' });
    const img = new Image();
    img.onerror = (e) => {
      console.error("ScenarioUpdater: Failed to load solution image", e);
    };
    img.src = solutionUrl;
    img.onload = () => {
      console.log("ScenarioUpdater: Solution image loaded, converting to ImageData", { 
        scenarioId: scenario.scenarioId, 
        imgWidth: img.width, 
        imgHeight: img.height,
        targetWidth: scenario.dimensions.width,
        targetHeight: scenario.dimensions.height
      });
      const imageData = getPixelData(
        img,
        scenario.dimensions.width,
        scenario.dimensions.height
      );
      console.log("ScenarioUpdater: Created solution ImageData", { scenarioId: scenario.scenarioId, width: imageData.width, height: imageData.height });
      handleSolutionPixelUpdate(scenario.scenarioId, imageData);
    };
  }, [solutionUrls, scenario, solutionPixels, handleSolutionPixelUpdate]);

  useEffect(() => {
    console.log("ScenarioUpdater: Checking pixels", {
      scenarioId,
      hasDrawingPixels: !!drawingPixels,
      hasSolutionPixels: !!solutionPixels,
      drawingWidth: drawingPixels?.width,
      drawingHeight: drawingPixels?.height,
      solutionWidth: solutionPixels?.width,
      solutionHeight: solutionPixels?.height,
    });
    
    if (!drawingPixels || !solutionPixels) {
      console.log("ScenarioUpdater: Missing pixels, skipping comparison", {
        hasDrawing: !!drawingPixels,
        hasSolution: !!solutionPixels,
      });
      return;
    }

    let worker: Worker | null = null;
    
    try {
      console.log("ScenarioUpdater: Creating worker for scenario", scenarioId);
      worker = new Worker(
        new URL('../../lib/utils/workers/imageComparisonWorker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = ({ data }) => {
        console.log("ScenarioUpdater: Worker completed", { scenarioId, accuracy: data.accuracy, hasDiff: !!data.diff });
        const { accuracy, diff } = data;

        if (!diff) {
          console.warn("ScenarioUpdater: Worker returned no diff");
          return;
        }

        batch(() => {
          dispatch(
            updateLevelAccuracyThunk(level, scenarioId, accuracy)
          );
          dispatch(
            addDifferenceUrl({
              scenarioId: scenarioId,
              differenceUrl: diff,
            })
          );
        });
        console.log("ScenarioUpdater: Dispatched diff URL for", scenarioId);
        if (worker) {
          worker.terminate();
        }
      };

      worker.onerror = (error) => {
        console.error("ScenarioUpdater: Worker error:", error);
        if (worker) {
          worker.terminate();
        }
      };

      // Copy buffers before transferring
      const drawingBuffer = drawingPixels.data.buffer.slice(0);
      const solutionBuffer = solutionPixels.data.buffer.slice(0);

      console.log("ScenarioUpdater: Sending to worker", {
        drawingBufferSize: drawingBuffer.byteLength,
        solutionBufferSize: solutionBuffer.byteLength,
        width: drawingPixels.width,
        height: drawingPixels.height,
      });

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
    }

    return () => {
      if (worker) {
        worker.terminate();
      }
    };
  }, [drawingPixels, solutionPixels, level, dispatch, scenarioId]);

  return <></>;
};

