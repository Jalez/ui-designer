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
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceState";
import { useEventSequenceGameProgressStore } from "@/events/core/eventSequenceGameProgressStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { resolveCanonicalStepId } from "@/events/core/eventsRuntimeDerived";
import { useScenarioArtifacts } from "@/scenario/hooks/useScenarioArtifacts";
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
  const selectedStepIdByScenario = useEventSequenceTimelineUiStore((state) => state.selectedStepIdByScenario);
  const runtimeKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
  const activeIndex = useEventSequenceGameProgressStore((state) => state.activeIndexByKey[runtimeKey] ?? 0);
  const solutionPixelSourceUrlRef = useRef<string | null>(null);
  const solutionPixelSourceStepIdRef = useRef<string | null>(null);
  const scenarioSequence = level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
  const selectedStepId = selectedStepIdByScenario[
    getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId)
  ] ?? null;
  const currentStepId = resolveCanonicalStepId({
    selectedSequenceStepId: selectedStepId,
    isCreatorRoute: isCreator,
    scenarioSequence,
    activeIndex,
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
    // Skip only when both URL AND selected step are unchanged. Re-notify on step change
    // even if the URL string is byte-identical, so ScenarioUpdater can re-run Path A.
    if (
      solutionPixelSourceUrlRef.current === solutionUrl
      && solutionPixelSourceStepIdRef.current === currentStepId
    ) {
      return;
    }

    // Clear stale solution so ScenarioUpdater doesn't compare against the previous step's solution
    // during the async gap before the new step's solution finishes loading.
    clearStoredSolutionSide(runtimeKey);

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
      solutionPixelSourceStepIdRef.current = currentStepId;

      notifyDrawboardPixels(runtimeKey, "solution", imageData);
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [
    currentStepId,
    runtimeKey,
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
  const selectedStepIdByScenario = useEventSequenceTimelineUiStore((state) => state.selectedStepIdByScenario);
  const activeIndexByKey = useEventSequenceGameProgressStore((state) => state.activeIndexByKey);

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
        // Solution pixels are sourced exclusively from the Redux URL (see ScenarioPixelsHydrator).
        // Skipping the direct live-iframe update ensures Path A (click) and Path B (batch replay)
        // compare against identical pixels derived from the same stored URL.
 
        return;
      }

      if (event.data.urlName === "drawingUrl") {
        notifyDrawboardPixels(
          getEventSequenceScenarioUiKey(currentLevel, event.data.scenarioId),
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
      clearStoredSolutionSide(getEventSequenceScenarioUiKey(currentLevel, scenarioId));
    });
  }, [currentLevel]);

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
        const runtimeKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
        const activeIndex = activeIndexByKey[runtimeKey] ?? 0;
        const differenceStepId = resolveCanonicalStepId({
          selectedSequenceStepId: selectedStepId,
          isCreatorRoute: isCreator,
          scenarioSequence,
          activeIndex,
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
              runtimeKey={runtimeKey}
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
