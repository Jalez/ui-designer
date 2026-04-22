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
  currentStepId: string;
  currentImageUrl: string | undefined;
  interactionTriggers: InteractionTrigger[];
  presentation: ArtboardPresentation;
  replaySequence: EventSequenceStep[];
  replayBatchRequest: ReplayBatchRequest;
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

export function ArtboardProvider({ children, scenario }: ArtboardProviderProps) {
  const { level } = useLevelContext();
  const { canEditCurrentGame, showLive } = useGameContext();
  const { currentStepId, stepIds, stepsById, runtime } = useEventsState();

  const isCreator = canEditCurrentGame;
  const interactive = level?.interactive ?? false;
  const usePerStepSolutionKeys = runtime.sequenceLength > 0 && Boolean(scenario.scenarioId);
  const [presentationByBoard, setPresentationByBoard] = useState<Record<ArtboardKind, ArtboardPresentation>>({
    drawing: getDefaultPresentation("drawing"),
    solution: getDefaultPresentation("solution"),
  });

  const setBoardPresentation = useCallback((board: ArtboardKind, presentation: ArtboardPresentation) => {
    setPresentationByBoard((current) => (
      current[board] === presentation ? current : { ...current, [board]: presentation }
    ));
  }, []);

  const currentDisplayStepId = runtime.activeReplayStepId ?? currentStepId;
  const currentDrawingStep = stepsById[currentDisplayStepId];
  const currentSolutionStep = stepsById[currentDisplayStepId];
  const drawingReplayVisibleStepIds = stepIds;
  const solutionReplayVisibleStepIds = stepIds;

  const shouldBypassSelectedStepReplay =
    isCreator
    && !showLive
    && Boolean(stepsById[currentStepId]?.drawingUrl);

  const drawingHiddenFromView = isCreator
    ? !showLive
    : !interactive && !showLive;
  const drawingShowStaticImage = isCreator
    ? !showLive
    : !interactive && !showLive;

  const solutionUrl = currentSolutionStep?.solutionUrl ?? "";
  const hasSolutionCapture = Boolean(solutionUrl.trim());
  const solutionFrameNeedsReplay = runtime.batchReplaySequence.length > 0;
  const solutionShowLiveFrame = showLive || solutionFrameNeedsReplay;
  const solutionMountFrame =
    solutionShowLiveFrame
    || canEditCurrentGame
    || (!usePerStepSolutionKeys && !hasSolutionCapture)
    || (usePerStepSolutionKeys && !hasSolutionCapture);

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
    currentStepId: currentDisplayStepId,
    currentImageUrl: currentDrawingStep?.drawingUrl ?? undefined,
    interactionTriggers: runtime.currentInteractionTriggers,
    presentation: presentationByBoard.drawing,
    replaySequence: runtime.replaySequence,
    replayBatchRequest: drawingReplayBatchRequest,
    forceEmptyReplaySequence: isCreator
      ? runtime.autoReplayRunning || shouldBypassSelectedStepReplay
      : runtime.autoReplayRunning,
    mountFrame: true,
    hiddenFromView: drawingHiddenFromView,
    showStaticImage: drawingShowStaticImage,
    showLiveFrame: showLive,
    showLoading: false,
  }), [
    currentDisplayStepId,
    currentDrawingStep?.drawingUrl,
    drawingHiddenFromView,
    drawingReplayBatchRequest,
    drawingShowStaticImage,
    isCreator,
    presentationByBoard.drawing,
    runtime,
    shouldBypassSelectedStepReplay,
    showLive,
  ]);

  const solution = useMemo<CurrentArtboardBoard>(() => ({
    kind: "solution",
    currentStepId: currentDisplayStepId,
    currentImageUrl: currentSolutionStep?.solutionUrl ?? undefined,
    interactionTriggers: runtime.currentInteractionTriggers,
    presentation: presentationByBoard.solution,
    replaySequence: runtime.replaySequence,
    replayBatchRequest: solutionReplayBatchRequest,
    forceEmptyReplaySequence: runtime.autoReplayRunning,
    mountFrame: solutionMountFrame,
    hiddenFromView: !showLive,
    showStaticImage: !showLive,
    showLiveFrame: solutionShowLiveFrame,
    showLoading: !canEditCurrentGame && !hasSolutionCapture,
  }), [
    canEditCurrentGame,
    currentDisplayStepId,
    currentSolutionStep?.solutionUrl,
    hasSolutionCapture,
    presentationByBoard.solution,
    runtime,
    showLive,
    solutionMountFrame,
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
