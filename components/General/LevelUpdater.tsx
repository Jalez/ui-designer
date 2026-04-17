'use client';

import React, { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { sendScoreToParentFrame } from "@/store/actions/score.actions";
import { ScenarioUpdater } from "./ScenarioUpdater";
import { imageDataFromRawRgba } from "@/lib/utils/drawboardSnapshot";
import {
  clearDrawboardPixelsStore,
  clearStoredSolutionSide,
  notifyDrawboardPixels,
} from "@/lib/drawboard/drawboardPixelsStore";
import { subscribeLiveSolutionFrameRemoved } from "@/lib/drawboard/solutionFrameLifecycle";
import {
  getEventSequenceScenarioUiKey,
  selectRuntimeState,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import { resolveCanonicalStepId } from "@/events/core/eventsRuntimeDerived";
import { useScenarioArtifacts } from "@/events/hooks/useScenarioArtifacts";
import { loadImageData } from "@/lib/drawboard/pixelComparison";
import type { scenario } from "@/types";

type ScenarioPixelsHydratorProps = {
  currentLevel: number;
  isCreator: boolean;
  scenario: scenario;
};

function ScenarioPixelsHydrator({
  currentLevel,
  isCreator,
  scenario,
}: ScenarioPixelsHydratorProps) {
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const selectedStepIdByScenario = useEventSequenceStore((state) => state.selectedStepIdByScenario);
  const runtimeByKey = useEventSequenceStore((state) => state.runtimeByKey);
  const solutionPixelSourceUrlRef = useRef<string | null>(null);
  const scenarioSequence = level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
  const selectedStepId = selectedStepIdByScenario[
    getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId)
  ] ?? null;
  const runtimeKey = `${currentLevel}:${scenario.scenarioId}:${isCreator ? "creator" : "game"}`;
  const runtime = selectRuntimeState(runtimeByKey, runtimeKey);
  const currentStepId = resolveCanonicalStepId({
    selectedSequenceStepId: selectedStepId,
    isCreatorContext: isCreator,
    scenarioSequence,
    activeIndex: runtime.activeIndex,
  });
  const { solutionUrl } = useScenarioArtifacts({
    scenario,
    isCreator,
    selectedEventSequenceStepId: currentStepId,
    gameplaySolutionStepId: currentStepId,
    scenarioSequence,
  });

  useEffect(() => {
    let cancelled = false;
    if (!solutionUrl?.trim()) {
      return;
    }
    if (solutionPixelSourceUrlRef.current === solutionUrl) {
      return;
    }

    // Clear stale solution so ScenarioUpdater doesn't compare against the previous step's solution
    // during the async gap before the new step's solution finishes loading.
    clearStoredSolutionSide(scenario.scenarioId);

    const hydrate = async () => {
      const imageData = await loadImageData(
        solutionUrl,
        scenario.dimensions.width,
        scenario.dimensions.height,
      ).catch(() => null);
      if (cancelled || !imageData) {
        return;
      }
      solutionPixelSourceUrlRef.current = solutionUrl;
      notifyDrawboardPixels(scenario.scenarioId, "solution", imageData);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    scenario.dimensions.height,
    scenario.dimensions.width,
    scenario.scenarioId,
    solutionUrl,
  ]);

  return null;
}

export const LevelUpdater = () => {
  const dispatch = useAppDispatch();
  const points = useAppSelector((state) => state.points);
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const mode = useAppSelector((state) => state.options.mode);
  const isCreator = mode === "creator";
  const selectedStepIdByScenario = useEventSequenceStore((state) => state.selectedStepIdByScenario);
  const runtimeByKey = useEventSequenceStore((state) => state.runtimeByKey);

  useEffect(() => {
    queueMicrotask(() => {
      clearDrawboardPixelsStore();
    });

    const handlePixelsFromIframe = (event: MessageEvent) => {
      if (event.data.message !== "pixels") return;
      if (!(event.data.dataURL instanceof ArrayBuffer)) return;

      const imageData = imageDataFromRawRgba(
        event.data.dataURL,
        event.data.width,
        event.data.height,
      );

      if (event.data.urlName === "solutionUrl") {
        notifyDrawboardPixels(
          event.data.scenarioId,
          "solution",
          imageData,
          typeof event.data.replaySignature === "string" ? event.data.replaySignature : null,
        );
        return;
      }

      if (event.data.urlName === "drawingUrl") {
        notifyDrawboardPixels(
          event.data.scenarioId,
          "drawing",
          imageData,
          typeof event.data.replaySignature === "string" ? event.data.replaySignature : null,
        );
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
    return subscribeLiveSolutionFrameRemoved((scenarioId) => {
      clearStoredSolutionSide(scenarioId);
    });
  }, []);

  if (!level) {
    return null;
  }

  return (
    <>
      {level.scenarios.map((scenario) => {
        const scenarioSequence = level.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
        const selectedStepId = selectedStepIdByScenario[
          getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId)
        ] ?? null;
        const runtime = selectRuntimeState(
          runtimeByKey,
          `${currentLevel}:${scenario.scenarioId}:${isCreator ? "creator" : "game"}`,
        );
        const differenceStepId = resolveCanonicalStepId({
          selectedSequenceStepId: selectedStepId,
          isCreatorContext: isCreator,
          scenarioSequence,
          activeIndex: runtime.activeIndex,
        });

        return (
          <ErrorBoundary key={scenario.scenarioId}>
            <ScenarioPixelsHydrator
              currentLevel={currentLevel}
              isCreator={isCreator}
              scenario={scenario}
            />
            <ScenarioUpdater
              scenario={scenario}
              differenceStepId={differenceStepId}
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

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}
