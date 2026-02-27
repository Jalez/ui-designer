'use client';

import React, { useCallback, useEffect, useState } from "react";
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
    setDrawingPixels({});
    setSolutionPixels({});

    const handlePixelsFromIframe = (event: MessageEvent) => {
      if (event.data.message !== "pixels") return;
      if (event.data.urlName === "solutionUrl") {
        setSolutionPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: event.data.dataURL,
        }));
        return;
      } else if (event.data.urlName === "drawingUrl") {
        setDrawingPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: event.data.dataURL,
        }));
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

  const solutions = useAppSelector((state) => state.solutions);

  useEffect(() => {
    const scenarioIds = Object.keys(solutionPixels);
    if (!level) return;
    const hasAllPixels = level.scenarios.every((s) => scenarioIds.includes(s.scenarioId));
    if (!hasAllPixels) return;
    // Only dispatch if not already marked as drawn — prevents continuous cascade
    if (solutions[level.name]?.drawn) return;
    dispatch(
      updateDrawnState({
        levelId: level.name,
        drawn: true,
      })
    );
  }, [solutionPixels, level, solutions, dispatch]);

  const handleSolutionPixelUpdate = useCallback((scenarioId: string, pixels: ImageData) => {
    setSolutionPixels((prev) => ({
      ...prev,
      [scenarioId]: pixels,
    }));
  }, []);

  const handleDrawingPixelUpdate = useCallback((scenarioId: string, pixels: ImageData) => {
    setDrawingPixels((prev) => ({
      ...prev,
      [scenarioId]: pixels,
    }));
  }, []);
  if (!level) return null;
  const scenarios = level.scenarios;
  // get the points from the current level

  return (
    <>
      {scenarios.map((scenario) => {
        return (
          <ErrorBoundary key={scenario.scenarioId}>
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

