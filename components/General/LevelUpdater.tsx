'use client';

import React, { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { sendScoreToParentFrame } from "@/store/actions/score.actions";
import { ScenarioUpdater } from "./ScenarioUpdater";
import { updateDrawnState } from "@/store/slices/solutions.slice";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export let scenarioDiffs = {};

export const LevelUpdater = () => {
  const [drawingPixels, setDrawingPixels] = useState<scenarioData>({});
  const [solutionPixels, setSolutionPixels] = useState<scenarioData>({});
  const points = useAppSelector((state) => state.points);
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);

  // get the level from the levels array
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  useEffect(() => {
    // reset the pixels when level changes
    console.log("LevelUpdater: Level changed, resetting pixels", currentLevel);
    setDrawingPixels({});
    setSolutionPixels({});

    const handlePixelsFromIframe = (event: MessageEvent) => {
      if (event.data.message !== "pixels") return;
      
      console.log("LevelUpdater: Received pixels message", event.data);
      
      // Reconstruct ImageData from ArrayBuffer
      const { dataURL: buffer, width, height, scenarioId: scenarioIdFromEvent, urlName } = event.data;
      if (!buffer || !width || !height) {
        console.warn("LevelUpdater: Missing required data", { buffer: !!buffer, width, height });
        return;
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("LevelUpdater: Failed to get canvas context");
        return;
      }
      
      const imgData = ctx.createImageData(width, height);
      const pixelData = new Uint8ClampedArray(buffer);
      imgData.data.set(pixelData);
      
      console.log("LevelUpdater: Created ImageData", { urlName, scenarioId: scenarioIdFromEvent, width, height });
      
      if (urlName === "solutionUrl") {
        setSolutionPixels((prev) => ({
          ...prev,
          [scenarioIdFromEvent]: imgData,
        }));
        return;
      } else if (urlName === "drawingUrl") {
        //We need to use the prev value here because there are rapid updates to the state and we need to guarantee that the state is always using the latest value
        setDrawingPixels((prev) => {
          const newState = {
            ...prev,
            [scenarioIdFromEvent]: imgData,
          };
          console.log("LevelUpdater: Updated drawing pixels", Object.keys(newState));
          return newState;
        });
      }
    };

    window.addEventListener("message", handlePixelsFromIframe);
    return () => {
      window.removeEventListener("message", handlePixelsFromIframe);
    };
  }, [currentLevel]);

  useEffect(() => {
    dispatch(sendScoreToParentFrame());
  }, [points.allPoints, dispatch]);

  useEffect(() => {
    // if both of the scenarios for this level have solution pixels now, we are ready for the comparison
    // look for the scenarioIds in the solutionPixels object
    const scenarioIds = Object.keys(solutionPixels);
    if (!level) return;
    const scenarios = level.scenarios;
    // go through each of the scenarios and check if the solutionPixels object has the scenarioId
    let hasAllPixels = true;
    for (const scenario of scenarios) {
      if (!scenarioIds.includes(scenario.scenarioId)) {
        hasAllPixels = false;
        break;
      }
    }
    if (!hasAllPixels) return;
    dispatch(
      updateDrawnState({
        levelId: level.name,
        drawn: true,
      })
    );
  }, [solutionPixels, level, dispatch]);

  const handleSolutionPixelUpdate = (scenarioId: string, pixels: ImageData) => {
    setSolutionPixels({
      ...solutionPixels,
      [scenarioId]: pixels,
    });
  };

  const handleDrawingPixelUpdate = (scenarioId: string, pixels: ImageData) => {
    setDrawingPixels({
      ...drawingPixels,
      [scenarioId]: pixels,
    });
  };
  if (!level) return null;
  const scenarios = level.scenarios;
  // get the points from the current level

  return (
    <>
      {scenarios.map((scenario) => {
        return (
          <ErrorBoundary key={Math.random() * 1000 + scenario.scenarioId}>
            <ScenarioUpdater
              scenario={scenario}
              drawingPixels={drawingPixels[scenario.scenarioId] || undefined}
              solutionPixels={solutionPixels[scenario.scenarioId] || undefined}
              handleSolutionPixelUpdate={handleSolutionPixelUpdate}
              handleDrawingPixelUpdate={handleDrawingPixelUpdate}
            />
          </ErrorBoundary>
        );
      })}
    </>
  );
};

type ErrorBoundaryState = {
  hasError: boolean;
};

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}

