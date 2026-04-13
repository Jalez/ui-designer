'use client';

import React, { useEffect, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { sendScoreToParentFrame } from "@/store/actions/score.actions";
import { ScenarioUpdater } from "./ScenarioUpdater";
import { updateDrawnState } from "@/store/slices/solutions.slice";
import { imageDataFromRawRgba } from "@/lib/utils/drawboardSnapshot";
import {
  clearDrawboardPixelsStore,
  clearStoredSolutionSide,
  notifyDrawboardPixels,
} from "@/lib/drawboard/drawboardPixelsStore";
import { subscribeLiveSolutionFrameRemoved } from "@/lib/drawboard/solutionFrameLifecycle";
import {
  getEventSequenceScenarioUiKey,
  getEventSequenceRuntimeKey,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  selectRuntimeState,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import {
  defaultTimelineStepIdForSolutionCapture,
} from "@/events/core/eventSequenceSolutionUrls";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { buildArtifactKey, hashArtifactFingerprint, type DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";
import {
  drawingArtifactFingerprint,
  solutionArtifactFingerprint,
  solutionStepArtifactFingerprint,
} from "@/lib/drawboard/artifactFingerprint";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";
import { loadImageData } from "@/lib/drawboard/pixelComparison";

// drawingPixels, solutionPixels should be objects, where key is the scenarioId and value is the ImageData
type scenarioData = {
  [key: string]: ImageData;
};

export const scenarioDiffs = {};

export const LevelUpdater = () => {
  const [drawingPixels, setDrawingPixels] = useState<scenarioData>({});
  const [solutionPixels, setSolutionPixels] = useState<scenarioData>({});
  const drawingPixelSourceUrlsRef = useRef<Record<string, string>>({});
  const solutionPixelSourceUrlsRef = useRef<Record<string, string>>({});
  const points = useAppSelector((state) => state.points);
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);
  const currentGameId = useGameStore((state) => state.currentGameId);
  const { drawboardCaptureMode } = useGameRuntimeConfig();
  const platformBucket = drawboardCaptureMode === "browser" ? getBrowserPlatformBucket() : null;

  // get the level from the levels array
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string | undefined>);
  const solutionUrls = useAppSelector((state) => state.solutionUrls as Record<string, string | undefined>);
  const selectedStepIdByScenario = useEventSequenceStore((state) => state.selectedStepIdByScenario);
  const runtimeByKey = useEventSequenceStore((state) => state.runtimeByKey);

  useEffect(() => {
    let cancelled = false;

    const hydratePixelsFromStoredUrls = async () => {
      if (!level?.scenarios?.length) {
        return;
      }
      for (const scenario of level.scenarios) {
        const width = scenario.dimensions.width;
        const height = scenario.dimensions.height;
        const drawingDescriptor: DrawboardArtifactDescriptor = {
          version: "v1",
          captureMode: drawboardCaptureMode,
          artifactType: "drawing",
          fingerprint: drawingArtifactFingerprint({
            html: level.code.html ?? "",
            css: level.code.css ?? "",
            js: level.code.js ?? "",
            scenario,
          }),
          gameId: currentGameId,
          levelIdentifier: level.identifier ?? null,
          levelName: level.name ?? null,
          scenarioId: scenario.scenarioId,
          stepId: null,
          platformBucket,
          width,
          height,
        };
        const drawingUrl = drawingUrls[buildArtifactKey(drawingDescriptor)]?.trim();
        const scenarioSequence = level.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
        const runtimeKey = getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, options.creator);
        const runtimeState = useEventSequenceStore.getState().getRuntimeState(runtimeKey);
        const activeIndex =
          runtimeState.activeIndex >= scenarioSequence.length ? 0 : runtimeState.activeIndex;
        const uiScenarioKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
        const selectedStepId =
          selectedStepIdByScenario[uiScenarioKey]?.trim() ?? null;
        const activeStepId =
          !options.creator && scenarioSequence.length > 0
            ? scenarioSequence[activeIndex]?.id ?? null
            : null;
        const solutionStepId =
          scenarioSequence.length > 0
            ? defaultTimelineStepIdForSolutionCapture(
                selectedStepId ?? activeStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID,
              )
            : defaultTimelineStepIdForSolutionCapture(selectedStepId);
        const solutionFingerprint = solutionArtifactFingerprint({
          html: level.solution?.html ?? "",
          css: level.solution?.css ?? "",
          js: level.solution?.js ?? "",
          scenario,
        });
        const selectedSolutionStep =
          scenarioSequence.find((step) => step.id === solutionStepId) ?? null;
        const activeSolutionFingerprint =
          scenarioSequence.length > 0
            ? solutionStepId === INITIAL_EVENT_SEQUENCE_STEP_ID
              ? hashArtifactFingerprint(["solution-step", solutionFingerprint, INITIAL_EVENT_SEQUENCE_STEP_ID])
              : selectedSolutionStep
                ? solutionStepArtifactFingerprint({
                    solutionFingerprint,
                    step: selectedSolutionStep,
                  })
                : solutionFingerprint
            : solutionFingerprint;
        const solutionDescriptor: DrawboardArtifactDescriptor = {
          version: "v1",
          captureMode: drawboardCaptureMode,
          artifactType: scenarioSequence.length > 0 ? "solution-step" : "solution",
          fingerprint: activeSolutionFingerprint,
          gameId: currentGameId,
          levelIdentifier: level.identifier ?? null,
          levelName: level.name ?? null,
          scenarioId: scenario.scenarioId,
          stepId: scenarioSequence.length > 0 ? solutionStepId : null,
          platformBucket,
          width,
          height,
        };
        const solutionUrl = solutionUrls[buildArtifactKey(solutionDescriptor)]?.trim();

        const previousDrawingUrl = drawingPixelSourceUrlsRef.current[scenario.scenarioId];
        if (drawingUrl && previousDrawingUrl !== drawingUrl) {
          try {
            const imageData = await loadImageData(drawingUrl, width, height);
            if (!cancelled && imageData) {
              drawingPixelSourceUrlsRef.current[scenario.scenarioId] = drawingUrl;
              setDrawingPixels((prev) => ({
                ...prev,
                [scenario.scenarioId]: imageData,
              }));
            }
          } catch {
            // Ignore hydration failures; live iframe pixels can still populate.
          }
        }

        const previousSolutionUrl = solutionPixelSourceUrlsRef.current[scenario.scenarioId];
        if (solutionUrl && previousSolutionUrl !== solutionUrl) {
          try {
            const imageData = await loadImageData(solutionUrl, width, height);
            if (!cancelled && imageData) {
              solutionPixelSourceUrlsRef.current[scenario.scenarioId] = solutionUrl;
              setSolutionPixels((prev) => ({
                ...prev,
                [scenario.scenarioId]: imageData,
              }));
            }
          } catch {
            // Ignore hydration failures; live iframe pixels can still populate.
          }
        }
      }
    };

    void hydratePixelsFromStoredUrls();
    return () => {
      cancelled = true;
    };
  }, [
    currentLevel,
    currentGameId,
    drawboardCaptureMode,
    drawingUrls,
    level,
    options.creator,
    platformBucket,
    selectedStepIdByScenario,
    solutionUrls,
  ]);

  useEffect(() => {
    // reset the pixels when level changes
    queueMicrotask(() => {
      setDrawingPixels({});
      setSolutionPixels({});
      drawingPixelSourceUrlsRef.current = {};
      solutionPixelSourceUrlsRef.current = {};
      clearDrawboardPixelsStore();
    });

    const handlePixelsFromIframe = (event: MessageEvent) => {
      if (event.data.message !== "pixels") return;
      if (!(event.data.dataURL instanceof ArrayBuffer)) return;
      const imageData = imageDataFromRawRgba(
        event.data.dataURL,
        event.data.width,
        event.data.height
      );
      if (event.data.urlName === "solutionUrl") {
        solutionPixelSourceUrlsRef.current[event.data.scenarioId] = "__live_iframe__";
        setSolutionPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: imageData,
        }));
        notifyDrawboardPixels(
          event.data.scenarioId,
          "solution",
          imageData,
          typeof event.data.replaySignature === "string" ? event.data.replaySignature : null,
        );
        return;
      } else if (event.data.urlName === "drawingUrl") {
        drawingPixelSourceUrlsRef.current[event.data.scenarioId] = "__live_iframe__";
        setDrawingPixels((prev) => ({
          ...prev,
          [event.data.scenarioId]: imageData,
        }));
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
      setSolutionPixels((prev) => {
        if (!(scenarioId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[scenarioId];
        return next;
      });
      delete solutionPixelSourceUrlsRef.current[scenarioId];
      clearStoredSolutionSide(scenarioId);
    });
  }, []);

  const solutions = useAppSelector((state) => state.solutions);

  useEffect(() => {
    const scenarioIds = Object.keys(solutionPixels);
    if (!level) return;
    const scenarios = Array.isArray(level.scenarios) ? level.scenarios : [];
    const hasAllPixels = scenarios.every((s) => scenarioIds.includes(s.scenarioId));
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

  if (!level) return null;
  const scenarios = Array.isArray(level.scenarios) ? level.scenarios : [];
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
              differenceStepId={(() => {
                const scenarioSeq = level.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
                if (scenarioSeq.length === 0) return null;
                const selectedStepId = selectedStepIdByScenario[
                  getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId)
                ]?.trim() || null;
                if (selectedStepId) return selectedStepId;
                if (!options.creator) {
                  const rk = getEventSequenceRuntimeKey(currentLevel, scenario.scenarioId, false);
                  const rt = selectRuntimeState(runtimeByKey, rk);
                  const idx = rt.activeIndex >= scenarioSeq.length ? 0 : rt.activeIndex;
                  return scenarioSeq[idx]?.id ?? INITIAL_EVENT_SEQUENCE_STEP_ID;
                }
                return INITIAL_EVENT_SEQUENCE_STEP_ID;
              })()}
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
