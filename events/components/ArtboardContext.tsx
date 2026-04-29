"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLevelContext } from "@/components/ArtBoards/LevelContext";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { useEventsState, type EventsRuntimeView } from "@/events/components/EventsContext";
import type { InteractionTrigger, EventSequenceStep, scenario } from "@/types";

export type ArtboardKind = "drawing" | "solution";
export type ArtboardPresentation = "live" | "static" | "diff" | "model";

export type ReplayBatchRequest = {
  enabled?: boolean;
  replaySequence: EventSequenceStep[];
  runId: number;
  visibleStepIds: string[];
} | null;

export type CurrentArtboardBoard = {
  kind: ArtboardKind;
  stepId: string;
  currentImageUrl: string | undefined;
  interactionTriggers: InteractionTrigger[];
  presentation: ArtboardPresentation;
  replaySequence: EventSequenceStep[];
  replayRefreshNonce: number;
  replayBatchRequest: ReplayBatchRequest;
  autoCapture: boolean;
  forceEmptyReplaySequence: boolean;
  mountFrame: boolean;
  hiddenFromView: boolean;
  showStaticImage: boolean;
  showLiveFrame: boolean;
  showLoading: boolean;
};

export type ArtboardContextValue = {
  drawing: CurrentArtboardBoard;
  solution: CurrentArtboardBoard;
  runtime: EventsRuntimeView;
  isCreator: boolean;
  solutionUrl: string;
  setBoardPresentation: (board: ArtboardKind, presentation: ArtboardPresentation) => void;
};

type ArtboardProviderProps = {
  children: ReactNode;
  scenario: scenario;
};

const ArtboardContext = createContext<ArtboardContextValue | null>(null);

function getDefaultPresentation(board: ArtboardKind): ArtboardPresentation {
  return board === "drawing" ? "static" : "model";
}

export function ArtboardProvider({ children }: ArtboardProviderProps) {
  const { level } = useLevelContext();
  const { canEditCurrentGame, isCreatorRoute, showLive } = useGameContext();
  const { selectedStepId, displayStepId, stepsById, runtime } = useEventsState();

  const isCreator = canEditCurrentGame;
  const interactive = level?.interactive ?? false;
  const [presentationByBoard, setPresentationByBoard] = useState<Record<ArtboardKind, ArtboardPresentation>>({
    drawing: getDefaultPresentation("drawing"),
    solution: getDefaultPresentation("solution"),
  });

  const setBoardPresentation = useCallback((board: ArtboardKind, presentation: ArtboardPresentation) => {
    setPresentationByBoard((current) => (
      current[board] === presentation ? current : { ...current, [board]: presentation }
    ));
  }, []);

  const currentDrawingStep = stepsById[displayStepId];
  const currentSolutionStep = stepsById[displayStepId];
  const selectedStep = selectedStepId ? stepsById[selectedStepId] : null;
  const selectedStepNeedsRefresh = Boolean(
    selectedStep
    && (selectedStep.drawingStale || selectedStep.solutionStale || selectedStep.accuracyStale),
  );
  const selectedStepManuallyRequested = Boolean(
    selectedStepId
    && runtime.activeRunId == null
    && !runtime.autoReplayRunning,
  );
  const drawingReplayVisibleStepIds = runtime.replayCaptureStepIdsByBoard.drawing;
  const solutionReplayVisibleStepIds = runtime.replayCaptureStepIdsByBoard.solution;

  const drawingShowLiveFrame = isCreatorRoute
    ? showLive
    : interactive || showLive;
  const drawingHiddenFromView = !drawingShowLiveFrame;
  const drawingShowStaticImage = !drawingShowLiveFrame;

  const solutionUrl = currentSolutionStep?.solutionUrl ?? "";
  const hasSolutionCapture = Boolean(solutionUrl.trim());
  const solutionShowLiveFrame = isCreatorRoute && showLive;
  const solutionReplayBatchActive =
    runtime.activeRunId != null
    && solutionReplayVisibleStepIds.length > 0;
  const solutionCaptureStepIdSet = useMemo(
    () => new Set(solutionReplayVisibleStepIds),
    [solutionReplayVisibleStepIds],
  );
  const solutionNeedsCapture =
    Boolean(displayStepId)
    && (
      !hasSolutionCapture
      || Boolean(currentSolutionStep?.solutionStale)
      || solutionCaptureStepIdSet.has(displayStepId)
    );
  const shouldCaptureSelectedStep = showLive || selectedStepNeedsRefresh || selectedStepManuallyRequested;
  const solutionAutoCapture = solutionShowLiveFrame || solutionNeedsCapture;
  const solutionMountFrame =
    solutionShowLiveFrame
    || solutionReplayBatchActive
    || solutionNeedsCapture;

  const drawingReplayBatchRequest = useMemo<ReplayBatchRequest>(() => {
    if (runtime.activeRunId == null || drawingReplayVisibleStepIds.length === 0) {
      return null;
    }
    return {
      enabled: true,
      replaySequence: runtime.batchReplaySequence,
      runId: runtime.activeRunId,
      visibleStepIds: drawingReplayVisibleStepIds,
    };
  }, [
    runtime.batchReplaySequence,
    drawingReplayVisibleStepIds,
    runtime.activeRunId,
  ]);

  const solutionReplayBatchRequest = useMemo<ReplayBatchRequest>(() => {
    if (runtime.activeRunId == null || solutionReplayVisibleStepIds.length === 0) {
      return null;
    }
    return {
      enabled: true,
      replaySequence: runtime.batchReplaySequence,
      runId: runtime.activeRunId,
      visibleStepIds: solutionReplayVisibleStepIds,
    };
  }, [
    runtime.batchReplaySequence,
    runtime.activeRunId,
    solutionReplayVisibleStepIds,
  ]);

  const drawing = useMemo<CurrentArtboardBoard>(() => ({
    kind: "drawing",
    stepId: displayStepId,
    currentImageUrl: currentDrawingStep?.drawingUrl ?? undefined,
    interactionTriggers: runtime.currentInteractionTriggers,
    presentation: presentationByBoard.drawing,
    replaySequence: runtime.replaySequence,
    replayRefreshNonce: runtime.selectedStepRefreshNonce,
    replayBatchRequest: drawingReplayBatchRequest,
    autoCapture: shouldCaptureSelectedStep,
    forceEmptyReplaySequence: runtime.autoReplayRunning,
    mountFrame: true,
    hiddenFromView: drawingHiddenFromView,
    showStaticImage: drawingShowStaticImage,
    showLiveFrame: drawingShowLiveFrame,
    showLoading: false,
  }), [
    displayStepId,
    currentDrawingStep?.drawingUrl,
    drawingHiddenFromView,
    drawingReplayBatchRequest,
    drawingShowLiveFrame,
    drawingShowStaticImage,
    presentationByBoard.drawing,
    runtime,
    shouldCaptureSelectedStep,
  ]);

  const solution = useMemo<CurrentArtboardBoard>(() => ({
    kind: "solution",
    stepId: displayStepId,
    currentImageUrl: currentSolutionStep?.solutionUrl ?? undefined,
    interactionTriggers: runtime.currentInteractionTriggers,
    presentation: presentationByBoard.solution,
    replaySequence: runtime.replaySequence,
    replayRefreshNonce: runtime.selectedStepRefreshNonce,
    replayBatchRequest: solutionReplayBatchRequest,
    autoCapture: solutionAutoCapture,
    forceEmptyReplaySequence: runtime.autoReplayRunning,
    mountFrame: solutionMountFrame,
    hiddenFromView: !solutionShowLiveFrame,
    showStaticImage: !solutionShowLiveFrame,
    showLiveFrame: solutionShowLiveFrame,
    showLoading: !canEditCurrentGame && solutionNeedsCapture,
  }), [
    canEditCurrentGame,
    displayStepId,
    currentSolutionStep?.solutionUrl,
    presentationByBoard.solution,
    runtime,
    solutionAutoCapture,
    solutionMountFrame,
    solutionNeedsCapture,
    solutionReplayBatchRequest,
    solutionShowLiveFrame,
  ]);

  const value = useMemo<ArtboardContextValue>(() => ({
    drawing,
    solution,
    runtime,
    isCreator,
    solutionUrl,
    setBoardPresentation,
  }), [
    drawing,
    isCreator,
    runtime,
    setBoardPresentation,
    solution,
    solutionUrl,
  ]);

  return (
    <ArtboardContext.Provider value={value}>
      {children}
    </ArtboardContext.Provider>
  );
}

export function useArtboardContext(): ArtboardContextValue {
  const ctx = useContext(ArtboardContext);
  if (!ctx) {
    throw new Error("useArtboardContext must be used within ArtboardProvider");
  }
  return ctx;
}
