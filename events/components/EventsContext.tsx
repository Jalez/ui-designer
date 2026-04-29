"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { addDrawingUrl } from "@/store/slices/drawingUrls.slice";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import { useLevelContext } from "@/components/ArtBoards/LevelContext";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { useEventRecorderContext } from "@/events/components/EventRecorderContext";
import {
  endReplayBatch,
  markReplayJourneyCompleted,
} from "@/events/core/eventSequenceFacades";
import {
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "@/events/core/eventSequenceAccuracyStore";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceReplayBatchStore } from "@/events/core/eventSequenceReplayBatchStore";
import { useEventSequenceReplayUiStore } from "@/events/core/eventSequenceReplayUiStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { useEventSequenceAutoRunPrefsStore } from "@/events/core/eventSequenceAutoRunPrefsStore";
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceReplayTypes";
import {
  logArtboardReplayDebug,
  getLatestUsableReplayComparisonResultForStep,
  selectBoardFreshnessMap,
  useArtboardReplayRuntimeStore,
} from "@/events/core/artboardReplayRuntimeStore";
import {
  clearDrawboardPixelsForScenario,
  getDrawboardPixelsPair,
  getDrawboardPixelsSideSerials,
  getDrawboardPixelsStepIds,
  notifyDrawboardPixels,
  notifyStepAccuracyResult,
} from "@/lib/drawboard/drawboardPixelsStore";
import { loadImageData, runPixelComparison } from "@/lib/drawboard/pixelComparison";
import { buildReplayCapturePlan, type ReplayCapturePlan } from "@/events/core/replayCapturePlan";
import {
  selectEventStepRuntimeByStep,
  useEventStepRuntimeStore,
} from "@/events/core/eventStepRuntimeStore";
import { useSequenceRuntimeLifecycle } from "@/events/hooks/useSequenceRuntimeLifecycle";
import { useStepCompareOrchestration } from "@/events/hooks/useStepCompareOrchestration";
import { useReplayComparisonCoordinator } from "@/events/hooks/useReplayComparisonCoordinator";
import type {
  FrameReplayStatusEvent,
  ReplayBatchCheckpoint,
  ReplayBatchStatusEvent,
} from "@/components/ArtBoards/Frame";
import type {
  EventSequenceStep,
  InteractionTrigger,
  VerifiedInteraction,
} from "@/types";

function formatStepAccuracyPercent(value: number): string {
  return `${parseFloat(value.toFixed(2))}%`;
}

function resolveAccuracyStatus(raw: number | null): "ready" | "pending" | "failed" | "missing" {
  if (raw === -1) {
    return "pending";
  }
  if (raw === -2) {
    return "failed";
  }
  if (typeof raw === "number" && raw >= 0) {
    return "ready";
  }
  return "missing";
}

type ReplayCaptureCoverage = {
  drawingStepIds: Set<string>;
  drawingVersion: number;
  solutionStepIds: Set<string>;
};

function getReplayCaptureCoverage(
  capturePlan: ReplayCapturePlan,
  drawingVersion: number,
): ReplayCaptureCoverage {
  return {
    drawingStepIds: new Set(capturePlan.captureStepIdsByBoard.drawing),
    drawingVersion,
    solutionStepIds: new Set(capturePlan.captureStepIdsByBoard.solution),
  };
}

function replayCapturePlanCoveredBy(
  capturePlan: ReplayCapturePlan,
  coverage: ReplayCaptureCoverage | null,
  drawingVersion: number,
): boolean {
  if (!coverage || coverage.drawingVersion !== drawingVersion) {
    return false;
  }
  return capturePlan.captureStepIdsByBoard.drawing.every((stepId) => coverage.drawingStepIds.has(stepId))
    && capturePlan.captureStepIdsByBoard.solution.every((stepId) => coverage.solutionStepIds.has(stepId));
}

export type EventStepReadModel = {
  stepId: string;
  drawingUrl: string | null;
  solutionUrl: string | null;
  diffUrl: string | null;
  accuracyRaw: number | null;
  accuracyStatus: "ready" | "pending" | "failed" | "missing";
  drawingStale: boolean;
  solutionStale: boolean;
  accuracyStale: boolean;
  interactionTriggers: InteractionTrigger[];
  replayStatus: ReturnType<typeof useSequenceReplayStore.getState>["getDiagnostics"] extends (key: string) => infer T
    ? T extends { stepStates: Record<string, infer U> }
      ? U | null
      : null
    : null;
  loading: boolean;
  comparisonFailed: boolean;
  measured: boolean;
  percent: number;
  accuracyText: string | null;
};

export type EventsRuntimeView = {
  runtimeKey: string | null;
  activeRunId: number | null;
  activeReplayStepId: string | null;
  autoReplayRunning: boolean;
  selectedStepId: string | null;
  displayStepId: string;
  currentInteractionTriggers: InteractionTrigger[];
  batchReplaySequence: EventSequenceStep[];
  replayCaptureStepIdsByBoard: {
    drawing: string[];
    solution: string[];
  };
  replaySequence: EventSequenceStep[];
  selectedStepRefreshNonce: number;
  sequenceLength: number;
};

export type EventsStateValue = {
  selectedStepId: string | null;
  displayStepId: string;
  stepIds: string[];
  stepsById: Record<string, EventStepReadModel>;
  runtime: EventsRuntimeView;
};

type CaptureCommitInput = {
  stepId?: string | null;
  url: string;
  runId?: number | null;
  persistScenarioUrl?: boolean;
  persistPerStep?: boolean;
};

type DiffCommitInput = {
  stepId?: string | null;
  diffUrl: string | null;
  accuracy: number | null;
};

export type EventsActionsValue = {
  commitDrawingCapture: (input: CaptureCommitInput) => void;
  commitSolutionCapture: (input: CaptureCommitInput) => void;
  commitDiffResult: (input: DiffCommitInput) => void;
  setInteractionTriggers: (stepId: string | null | undefined, triggers: InteractionTrigger[]) => void;
  selectStep: (stepId: string | null) => void;
  handleVerifiedInteraction: (interaction: VerifiedInteraction) => void;
  handleDrawingReplayBatchCheckpoint: (checkpoint: ReplayBatchCheckpoint) => void;
  handleSolutionReplayBatchCheckpoint: (checkpoint: ReplayBatchCheckpoint) => void;
  handleDrawingReplayBatchStatus: (event: ReplayBatchStatusEvent) => void;
  handleSolutionReplayBatchStatus: (event: ReplayBatchStatusEvent) => void;
  handleDrawingReplayStatus: (event: FrameReplayStatusEvent) => void;
};

type EventsContextValue = {
  state: EventsStateValue;
  actions: EventsActionsValue;
};

const EventsContext = createContext<EventsContextValue | null>(null);

function resolveReplayDisplayStepId(params: {
  activeRunId: number | null;
  replayActiveStepState: { runId: number | null; stepId: string | null };
  initialStepId: string;
  selectedStepId: string | null;
  fallbackDisplayStepId: string;
}): string {
  const { activeRunId, replayActiveStepState, initialStepId, selectedStepId, fallbackDisplayStepId } = params;
  if (activeRunId == null) {
    return selectedStepId ?? fallbackDisplayStepId;
  }
  if (replayActiveStepState.runId === activeRunId && replayActiveStepState.stepId) {
    return replayActiveStepState.stepId;
  }
  return initialStepId || selectedStepId || fallbackDisplayStepId;
}

export function EventsProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { currentLevel } = useLevelContext();
  const { canEditCurrentGame } = useGameContext();
  const {
    effectiveSelectedSequenceStepId,
    interactionTriggers: frameEvents,
    recordingMode,
    replaySequence,
  } = useEventRecorderContext();
  const {
    gameActiveStepId,
    focusedEventStepId,
    autoReplayOnMount,
    scenarioScopeKey,
    selectedScenario,
    selectedScenarioSequence,
    sequenceRuntime,
    staleStepIds,
  } = useScenarioContext();

  const isCreator = canEditCurrentGame;
  const runtimeKey = scenarioScopeKey;
  const scenarioUiKey = selectedScenario
    ? getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)
    : null;
  const selectedStepRefreshNonce = useEventSequenceTimelineUiStore((state) => (
    scenarioUiKey ? state.selectedStepRefreshNonceByScenario[scenarioUiKey] ?? 0 : 0
  ));
  const initialStepId = selectedScenarioSequence[0]?.id ?? "";
  const focusedStepId = focusedEventStepId ?? initialStepId;
  const selectedStepId: string | null = (() => {
    if (selectedScenarioSequence.length > 0) {
      const scrubbed = effectiveSelectedSequenceStepId?.trim();
      if (scrubbed) {
        return scrubbed;
      }
      if (!isCreator && gameActiveStepId != null) {
        return gameActiveStepId;
      }
      return null;
    }
    return focusedStepId || null;
  })();
  const fallbackDisplayStepId = focusedStepId || initialStepId;

  const drawingFreshnessByStep = useArtboardReplayRuntimeStore((state) => (
    selectBoardFreshnessMap(state.freshnessByKey, runtimeKey, "drawing")
  ));
  const solutionFreshnessByStep = useArtboardReplayRuntimeStore((state) => (
    selectBoardFreshnessMap(state.freshnessByKey, runtimeKey, "solution")
  ));
  const stepRuntimeByStepId = useEventStepRuntimeStore((state) => (
    selectEventStepRuntimeByStep(state.runtimeByRuntimeKey, runtimeKey)
  ));
  const eventSequenceRunActive = useSequenceReplayStore((state) => state.isRunning);
  const replayBatchRunId = sequenceRuntime.replayBatchSession?.runId ?? null;
  const sequenceCapture = useEventSequenceCaptureStore((state) => (
    selectCaptureState(state.captureByKey, runtimeKey)
  ));

  const [replayActiveStepState, setReplayActiveStepState] = useState<{
    runId: number | null;
    stepId: string | null;
  }>({ runId: null, stepId: null });

  const displayStepId = eventSequenceRunActive
    ? resolveReplayDisplayStepId({
      activeRunId: replayBatchRunId,
      replayActiveStepState,
      initialStepId,
      selectedStepId,
      fallbackDisplayStepId,
    })
    : selectedStepId ?? fallbackDisplayStepId;
  useEffect(() => {
    if (!runtimeKey || !selectedStepId) {
      return;
    }
    useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, selectedStepId, {
      interactionTriggers: Array.isArray(frameEvents) ? frameEvents : [],
    });
  }, [selectedStepId, frameEvents, runtimeKey]);

  const { handleVerifiedInteraction } = useSequenceRuntimeLifecycle({
    isCreator,
    runtimeKey: runtimeKey ?? "",
    scenarioSequence: selectedScenarioSequence,
    sequenceRuntime: {
      activeIndex: sequenceRuntime.activeIndex,
      recordingMode,
    },
    gameplayActiveSequenceStep: gameActiveStepId
      ? selectedScenarioSequence.find((step) => step.id === gameActiveStepId) ?? null
      : null,
  });

  useStepCompareOrchestration({
    scenarioSequence: selectedScenarioSequence,
    runtimeKey: runtimeKey ?? "",
    isCreator,
    selectedEventSequenceStepId: effectiveSelectedSequenceStepId,
    replaySequence,
    gameplayActiveSequenceStep: gameActiveStepId
      ? selectedScenarioSequence.find((step) => step.id === gameActiveStepId) ?? null
      : null,
    suppressSequenceMetrics: false,
  });

  const updateBoardFreshness = useCallback((
    board: "drawing" | "solution",
    stepId: string,
    imageUrl: string,
    runId: number | null = null,
  ) => {
    if (!runtimeKey) {
      return;
    }
    useArtboardReplayRuntimeStore.getState().setBoardStepFreshness(runtimeKey, board, stepId, () => ({
      imageUrl,
      capturedAt: Date.now(),
      isReady: Boolean(imageUrl),
      isStale: false,
      lastRunId: runId,
    }));
  }, [runtimeKey]);

  const manualCompareInFlightRef = useRef<Set<string>>(new Set());

  const maybeCompareManualStepPixels = useCallback((stepId: string) => {
    if (!runtimeKey) {
      return;
    }
    const pixelStepIds = getDrawboardPixelsStepIds(runtimeKey);
    if (pixelStepIds.drawing !== stepId || pixelStepIds.solution !== stepId) {
      logArtboardReplayDebug("manual-pixel-compare-skip", {
        reason: "pixel-step-mismatch",
        runtimeKey,
        stepId,
        pixelStepIds,
      });
      return;
    }
    const pixels = getDrawboardPixelsPair(runtimeKey);
    if (!pixels.drawing || !pixels.solution) {
      logArtboardReplayDebug("manual-pixel-compare-skip", {
        reason: "missing-pixels",
        runtimeKey,
        stepId,
        hasDrawingPixels: Boolean(pixels.drawing),
        hasSolutionPixels: Boolean(pixels.solution),
      });
      return;
    }
    const sideSerials = getDrawboardPixelsSideSerials(runtimeKey);
    const compareKey = `${runtimeKey}:${stepId}:${sideSerials.drawing}:${sideSerials.solution}`;
    if (manualCompareInFlightRef.current.has(compareKey)) {
      logArtboardReplayDebug("manual-pixel-compare-skip", {
        reason: "compare-in-flight",
        runtimeKey,
        stepId,
        sideSerials,
      });
      return;
    }

    manualCompareInFlightRef.current.add(compareKey);
    logArtboardReplayDebug("manual-pixel-compare-start", {
      runtimeKey,
      stepId,
      sideSerials,
    });
    void runPixelComparison(pixels.drawing, pixels.solution)
      .then(({ accuracy, diff }) => {
        notifyStepAccuracyResult(runtimeKey, stepId, accuracy, sideSerials);
        useArtboardReplayRuntimeStore.getState().setReplayComparisonResult(runtimeKey, {
          accuracy,
          comparedAt: Date.now(),
          diff,
          runId: -1,
          stepId,
        });
        useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, stepId, accuracy);
        useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, stepId, {
          accuracyRaw: accuracy,
          diffUrl: diff,
        });
        logArtboardReplayDebug("manual-pixel-compare-result", {
          runtimeKey,
          stepId,
          accuracy,
          hasDiff: Boolean(diff),
          sideSerials,
        });
      })
      .catch((error) => {
        useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, stepId, -2);
        useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, stepId, {
          accuracyRaw: -2,
        });
        logArtboardReplayDebug("manual-pixel-compare-error", {
          runtimeKey,
          stepId,
          error,
        });
      })
      .finally(() => {
        manualCompareInFlightRef.current.delete(compareKey);
      });
  }, [runtimeKey]);

  const notifyManualCapturePixels = useCallback((
    board: "drawing" | "solution",
    stepId: string,
    imageUrl: string,
  ) => {
    if (!runtimeKey || !selectedScenario) {
      return;
    }
    void loadImageData(
      imageUrl,
      selectedScenario.dimensions.width,
      selectedScenario.dimensions.height,
    )
      .then((imageData) => {
        if (!imageData) {
          logArtboardReplayDebug("manual-capture-pixels-skip", {
            board,
            reason: "missing-image-data",
            runtimeKey,
            stepId,
          });
          return;
        }
        notifyDrawboardPixels(runtimeKey, board, imageData, null, stepId);
        logArtboardReplayDebug("manual-capture-pixels-notified", {
          board,
          runtimeKey,
          stepId,
          width: selectedScenario.dimensions.width,
          height: selectedScenario.dimensions.height,
        });
        maybeCompareManualStepPixels(stepId);
      })
      .catch((error) => {
        logArtboardReplayDebug("manual-capture-pixels-error", {
          board,
          runtimeKey,
          stepId,
          error,
        });
      });
  }, [maybeCompareManualStepPixels, runtimeKey, selectedScenario]);

  const commitDrawingCapture = useCallback((input: CaptureCommitInput) => {
    if (!selectedScenario || !runtimeKey || !input.url) {
      logArtboardReplayDebug("manual-capture-skip-drawing", {
        reason: !selectedScenario ? "missing-scenario" : !runtimeKey ? "missing-runtime-key" : "missing-url",
        displayStepId,
        inputStepId: input.stepId ?? null,
      });
      return;
    }
    if (selectedScenarioSequence.length > 0 && !input.stepId) {
      logArtboardReplayDebug("manual-capture-skip-drawing", {
        reason: "missing-step-id-for-sequence",
        displayStepId,
        runtimeKey,
      });
      return;
    }
    const targetStepId = input.stepId ?? displayStepId;
    if (!targetStepId) {
      logArtboardReplayDebug("manual-capture-skip-drawing", {
        reason: "missing-target-step-id",
        displayStepId,
        runtimeKey,
      });
      return;
    }
    logArtboardReplayDebug("manual-capture-commit-drawing", {
      runtimeKey,
      targetStepId,
      inputStepId: input.stepId ?? null,
      runId: input.runId ?? null,
      persistScenarioUrl: Boolean(input.persistScenarioUrl),
      persistPerStep: Boolean(input.persistPerStep),
      urlLength: input.url.length,
    });
    useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, targetStepId, {
      drawingUrl: input.url,
    });
    updateBoardFreshness("drawing", targetStepId, input.url, input.runId ?? null);
    notifyManualCapturePixels("drawing", targetStepId, input.url);
    if (input.persistScenarioUrl) {
      dispatch(addDrawingUrl({
        drawingUrl: input.url,
        scenarioId: selectedScenario.scenarioId,
      }));
    }
  }, [
    dispatch,
    displayStepId,
    notifyManualCapturePixels,
    runtimeKey,
    selectedScenario,
    selectedScenarioSequence.length,
    updateBoardFreshness,
  ]);

  const commitSolutionCapture = useCallback((input: CaptureCommitInput) => {
    if (!runtimeKey || !input.url) {
      logArtboardReplayDebug("manual-capture-skip-solution", {
        reason: !runtimeKey ? "missing-runtime-key" : "missing-url",
        displayStepId,
        inputStepId: input.stepId ?? null,
      });
      return;
    }
    if (selectedScenarioSequence.length > 0 && !input.stepId) {
      logArtboardReplayDebug("manual-capture-skip-solution", {
        reason: "missing-step-id-for-sequence",
        displayStepId,
        runtimeKey,
      });
      return;
    }
    const targetStepId = input.stepId ?? displayStepId;
    if (!targetStepId) {
      logArtboardReplayDebug("manual-capture-skip-solution", {
        reason: "missing-target-step-id",
        displayStepId,
        runtimeKey,
      });
      return;
    }
    logArtboardReplayDebug("manual-capture-commit-solution", {
      runtimeKey,
      targetStepId,
      inputStepId: input.stepId ?? null,
      runId: input.runId ?? null,
      persistScenarioUrl: Boolean(input.persistScenarioUrl),
      persistPerStep: Boolean(input.persistPerStep),
      urlLength: input.url.length,
    });
    useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, targetStepId, {
      solutionUrl: input.url,
    });
    updateBoardFreshness("solution", targetStepId, input.url, input.runId ?? null);
    notifyManualCapturePixels("solution", targetStepId, input.url);
  }, [
    displayStepId,
    notifyManualCapturePixels,
    runtimeKey,
    selectedScenarioSequence.length,
    updateBoardFreshness,
  ]);

  const commitDiffResult = useCallback((input: DiffCommitInput) => {
    if (!runtimeKey) {
      return;
    }
    const targetStepId = input.stepId ?? displayStepId;
    if (!targetStepId) {
      return;
    }
    useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, targetStepId, {
      accuracyRaw: input.accuracy,
      diffUrl: input.diffUrl,
    });
    useEventSequenceCaptureStore.getState().setStepAccuracy(runtimeKey, targetStepId, input.accuracy ?? -2);
  }, [
    displayStepId,
    runtimeKey,
  ]);

  const stepIds = useMemo(() => {
    const ids = selectedScenarioSequence.map((step) => step.id);
    if (ids.length > 0) {
      return ids;
    }
    return selectedStepId ? [selectedStepId] : [];
  }, [selectedStepId, selectedScenarioSequence]);
  const displayStepCount = stepIds.length;

  const currentInteractionTriggers = (selectedStepId ? stepRuntimeByStepId[selectedStepId]?.interactionTriggers : null) ?? frameEvents;

  const setActiveReplayDisplayStep = useCallback((runId: number, stepId: string | null) => {
    setReplayActiveStepState((current) => {
      if (current.runId === runId && current.stepId === stepId) {
        return current;
      }
      return { runId, stepId };
    });
  }, [setReplayActiveStepState]);

  const stepsById = useMemo<Record<string, EventStepReadModel>>(() => {
    return stepIds.reduce<Record<string, EventStepReadModel>>((result, stepId) => {
      const latestReplayResult = runtimeKey
        ? getLatestUsableReplayComparisonResultForStep(runtimeKey, stepId)
        : null;
      const stepRuntime = stepRuntimeByStepId[stepId];
      const accuracyRaw =
        sequenceCapture.stepAccuraciesByStepId[stepId]?.accuracy
        ?? stepRuntime?.accuracyRaw
        ?? null;
      const accuracyStatus = resolveAccuracyStatus(accuracyRaw);
      const measured = accuracyStatus === "ready";
      const drawingUrl =
        stepRuntime?.drawingUrl
        ?? drawingFreshnessByStep[stepId]?.imageUrl
        ?? null;
      const solutionUrl =
        stepRuntime?.solutionUrl
        ?? solutionFreshnessByStep[stepId]?.imageUrl
        ?? null;
      const diffUrl =
        latestReplayResult?.diff
        ?? stepRuntime?.diffUrl
        ?? null;
      const replayStatus = sequenceRuntime.replayDiagnostics.stepStates[stepId] ?? null;
      const accuracyStale = Boolean(staleStepIds?.has(stepId));

      result[stepId] = {
        stepId,
        drawingUrl,
        solutionUrl,
        diffUrl,
        accuracyRaw,
        accuracyStatus,
        drawingStale: !drawingUrl?.trim() || Boolean(drawingFreshnessByStep[stepId]?.isStale),
        solutionStale: !solutionUrl?.trim() || Boolean(solutionFreshnessByStep[stepId]?.isStale),
        accuracyStale,
        interactionTriggers: stepRuntime?.interactionTriggers ?? (stepId === selectedStepId ? currentInteractionTriggers : []),
        replayStatus,
        loading: accuracyStatus === "pending",
        comparisonFailed: accuracyStatus === "failed",
        measured,
        percent: measured && typeof accuracyRaw === "number" ? accuracyRaw : 0,
        accuracyText: measured && typeof accuracyRaw === "number"
          ? formatStepAccuracyPercent(accuracyRaw)
          : accuracyStatus === "failed"
            ? "failed"
            : null,
      };
      return result;
    }, {});
  }, [
    stepRuntimeByStepId,
    currentInteractionTriggers,
    selectedStepId,
    drawingFreshnessByStep,
    runtimeKey,
    sequenceCapture.stepAccuraciesByStepId,
    sequenceRuntime.replayDiagnostics.stepStates,
    solutionFreshnessByStep,
    staleStepIds,
    stepIds,
  ]);

  const replayCapturePlan = useMemo(() => buildReplayCapturePlan({
    drawingFreshnessByStep,
    solutionFreshnessByStep,
    steps: stepIds.map((stepId) => ({
      stepId,
      drawingUrl: stepsById[stepId]?.drawingUrl,
      solutionUrl: stepsById[stepId]?.solutionUrl,
    })),
  }), [
    drawingFreshnessByStep,
    solutionFreshnessByStep,
    stepIds,
    stepsById,
  ]);
  const replayStepIdsByBoard = replayCapturePlan.captureStepIdsByBoard;

  const staleReplaySignature = useMemo(() => {
    const signatures: string[] = [];
    if (replayStepIdsByBoard.drawing.length > 0) {
      signatures.push(`drawing:${replayStepIdsByBoard.drawing.join("|")}`);
    }
    if (replayStepIdsByBoard.solution.length > 0) {
      signatures.push(`solution:${replayStepIdsByBoard.solution.join("|")}`);
    }
    return signatures.join("||");
  }, [replayStepIdsByBoard.drawing, replayStepIdsByBoard.solution]);

  const boardRunStatusRef = useRef<{
    runId: number | null;
    drawing?: "started" | "completed" | "cancelled" | "failed";
    solution?: "started" | "completed" | "cancelled" | "failed";
  }>({ runId: null });
  const settledComparisonStepIdsRef = useRef<{
    runId: number | null;
    stepIds: Set<string>;
  }>({ runId: null, stepIds: new Set() });
  const terminalReplayFinalizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedReplaySignatureRef = useRef<string | null>(null);
  const activeReplayCaptureCoverageRef = useRef<{
    coverage: ReplayCaptureCoverage;
    runId: number;
  } | null>(null);
  const completedReplayCaptureCoverageRef = useRef<ReplayCaptureCoverage | null>(null);
  const fallbackCaptureRegisteredRunIdsRef = useRef<Set<number>>(new Set());
  const pendingAccuracyInitializedRunIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => () => {
    if (terminalReplayFinalizeTimeoutRef.current) {
      clearTimeout(terminalReplayFinalizeTimeoutRef.current);
      terminalReplayFinalizeTimeoutRef.current = null;
    }
  }, []);

  const finishReplayRun = useCallback((runId: number, ignoreMissingComparisons = false) => {
    if (!runtimeKey) {
      return;
    }
    const batch = useSequenceReplayStore.getState().getBatch(runtimeKey);
    if (!batch || batch.runId !== runId) {
      return;
    }
    const status = boardRunStatusRef.current;
    if (status.runId !== runId) {
      return;
    }
    const terminal = (value?: string) => value === "completed" || value === "cancelled" || value === "failed";
    if (!terminal(status.drawing) || !terminal(status.solution)) {
      return;
    }
    const settled = settledComparisonStepIdsRef.current;
    const missingStepIds = settled.runId === runId
      ? stepIds.filter((stepId) => !settled.stepIds.has(stepId))
      : stepIds;
    if (missingStepIds.length > 0 && !ignoreMissingComparisons) {
      logArtboardReplayDebug("finish-waiting-for-comparisons", {
        runId,
        runtimeKey,
        missingStepIds,
        settledStepIds: Array.from(settled.stepIds),
        status,
      });
      return;
    }
    if (terminalReplayFinalizeTimeoutRef.current) {
      clearTimeout(terminalReplayFinalizeTimeoutRef.current);
      terminalReplayFinalizeTimeoutRef.current = null;
    }
    const activeCoverage = activeReplayCaptureCoverageRef.current;
    if (activeCoverage?.runId === runId) {
      completedReplayCaptureCoverageRef.current = activeCoverage.coverage;
      activeReplayCaptureCoverageRef.current = null;
    }
    completedReplaySignatureRef.current = staleReplaySignature || null;
    logArtboardReplayDebug("finish-replay-run", {
      runId,
      runtimeKey,
      ignoredMissingComparisons: ignoreMissingComparisons,
      missingStepIds,
      settledStepIds: Array.from(settled.stepIds),
      status,
    });
    markReplayJourneyCompleted(runtimeKey, displayStepCount);
    useSequenceReplayStore.getState().setBatchProgress(runtimeKey, displayStepCount, displayStepCount);
    endReplayBatch(runtimeKey);
  }, [displayStepCount, runtimeKey, staleReplaySignature, stepIds]);

  const maybeFinishReplayRun = useCallback((runId: number) => {
    finishReplayRun(runId);
  }, [finishReplayRun]);

  const scheduleTerminalReplayFinalize = useCallback((runId: number) => {
    if (terminalReplayFinalizeTimeoutRef.current) {
      clearTimeout(terminalReplayFinalizeTimeoutRef.current);
    }
    terminalReplayFinalizeTimeoutRef.current = setTimeout(() => {
      terminalReplayFinalizeTimeoutRef.current = null;
      finishReplayRun(runId, true);
    }, 5000);
  }, [finishReplayRun]);

  const registerBoardStatus = useCallback((
    runId: number,
    board: "drawing" | "solution",
    status: "started" | "completed" | "cancelled" | "failed",
  ): boolean => {
    const current = boardRunStatusRef.current;
    boardRunStatusRef.current = current.runId === runId
      ? { ...current, [board]: status }
      : { runId, [board]: status };
    const next = boardRunStatusRef.current;
    const terminal = (value?: string) => value === "completed" || value === "cancelled" || value === "failed";
    return Boolean(terminal(next.drawing) && terminal(next.solution));
  }, []);

  const handleComparisonSettled = useCallback((token: { runId: number; stepId: string }) => {
    const current = settledComparisonStepIdsRef.current;
    const next = current.runId === token.runId
      ? current
      : { runId: token.runId, stepIds: new Set<string>() };
    next.stepIds.add(token.stepId);
    settledComparisonStepIdsRef.current = next;
    maybeFinishReplayRun(token.runId);
  }, [maybeFinishReplayRun]);

  const { clearRun, registerBoardCapture } = useReplayComparisonCoordinator({
    onComparisonSettled: handleComparisonSettled,
    runtimeKey: runtimeKey ?? "",
    scenarioDimensions: selectedScenario?.dimensions ?? { width: 0, height: 0 },
  });

  const initializedReplayRunIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!runtimeKey || replayBatchRunId == null) {
      initializedReplayRunIdRef.current = null;
      return;
    }
    if (initializedReplayRunIdRef.current === replayBatchRunId) {
      return;
    }
    initializedReplayRunIdRef.current = replayBatchRunId;
    settledComparisonStepIdsRef.current = { runId: replayBatchRunId, stepIds: new Set() };
    fallbackCaptureRegisteredRunIdsRef.current.delete(replayBatchRunId);
    pendingAccuracyInitializedRunIdsRef.current.delete(replayBatchRunId);
    activeReplayCaptureCoverageRef.current = {
      coverage: getReplayCaptureCoverage(replayCapturePlan, sequenceCapture.drawingVersion),
      runId: replayBatchRunId,
    };
    clearRun(replayBatchRunId);
    replayCapturePlan.reusableCaptures.forEach((capture) => {
      registerBoardCapture({
        ...capture,
        runId: replayBatchRunId,
      });
    });
    const drawingDone = replayCapturePlan.captureStepIdsByBoard.drawing.length === 0
      ? registerBoardStatus(replayBatchRunId, "drawing", "completed")
      : false;
    const solutionDone = replayCapturePlan.captureStepIdsByBoard.solution.length === 0
      ? registerBoardStatus(replayBatchRunId, "solution", "completed")
      : false;

    if (drawingDone || solutionDone) {
      queueMicrotask(() => {
        maybeFinishReplayRun(replayBatchRunId);
        if (drawingDone && solutionDone) {
          scheduleTerminalReplayFinalize(replayBatchRunId);
        }
      });
    }
  }, [
    clearRun,
    maybeFinishReplayRun,
    registerBoardCapture,
    registerBoardStatus,
    replayBatchRunId,
    replayCapturePlan,
    runtimeKey,
    scheduleTerminalReplayFinalize,
    sequenceCapture.drawingVersion,
  ]);

  const queuedStaleReplaySignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!staleReplaySignature) {
      queuedStaleReplaySignatureRef.current = null;
      completedReplaySignatureRef.current = null;
      completedReplayCaptureCoverageRef.current = null;
      return;
    }
    if (
      !autoReplayOnMount
      || !runtimeKey
      || !selectedScenario
      || !selectedScenarioSequence.length
      || recordingMode !== "idle"
      || eventSequenceRunActive
    ) {
      return;
    }
    const autoRunPrefs = useEventSequenceAutoRunPrefsStore.getState();
    const queuedRequest = autoRunPrefs.queuedAutoReplayRequest;
    if (
      queuedRequest
      && queuedRequest.runtimeKey === runtimeKey
      && queuedRequest.scenarioId === selectedScenario.scenarioId
    ) {
      return;
    }
    if (queuedStaleReplaySignatureRef.current === staleReplaySignature) {
      return;
    }
    if (completedReplaySignatureRef.current === staleReplaySignature) {
      return;
    }
    if (
      replayCapturePlanCoveredBy(
        replayCapturePlan,
        completedReplayCaptureCoverageRef.current,
        sequenceCapture.drawingVersion,
      )
    ) {
      completedReplaySignatureRef.current = staleReplaySignature;
      return;
    }
    queuedStaleReplaySignatureRef.current = staleReplaySignature;
    const restoreStepId =
      useEventSequenceTimelineUiStore
        .getState()
        .getSelectedStepIdForScenario(currentLevel, selectedScenario.scenarioId);
    autoRunPrefs.queueAutoReplayRequest({
      levelId: currentLevel,
      originalSelectedStepId: restoreStepId,
      runtimeKey,
      scenarioId: selectedScenario.scenarioId,
      source: "stale",
      totalSteps: displayStepCount,
    });
  }, [
    currentLevel,
    autoReplayOnMount,
    eventSequenceRunActive,
    recordingMode,
    runtimeKey,
    selectedScenario,
    selectedScenarioSequence.length,
    staleReplaySignature,
    initialStepId,
    displayStepCount,
    replayCapturePlan,
    sequenceCapture.drawingVersion,
  ]);

  const registerFallbackCapturesForMissingComparisons = useCallback((runId: number) => {
    if (fallbackCaptureRegisteredRunIdsRef.current.has(runId)) {
      return;
    }
    fallbackCaptureRegisteredRunIdsRef.current.add(runId);
    const settled = settledComparisonStepIdsRef.current;
    const missingStepIds = settled.runId === runId
      ? stepIds.filter((stepId) => !settled.stepIds.has(stepId))
      : stepIds;

    logArtboardReplayDebug("fallback-captures-for-missing-comparisons", {
      runId,
      runtimeKey,
      missingStepIds: missingStepIds.map((stepId) => {
        const step = stepsById[stepId];
        return {
          stepId,
          hasDrawingUrl: Boolean(step?.drawingUrl?.trim()),
          hasSolutionUrl: Boolean(step?.solutionUrl?.trim()),
          accuracyRaw: step?.accuracyRaw ?? null,
          accuracyStatus: step?.accuracyStatus ?? null,
          drawingStale: step?.drawingStale ?? null,
          solutionStale: step?.solutionStale ?? null,
        };
      }),
      settledStepIds: Array.from(settled.stepIds),
    });

    missingStepIds.forEach((stepId) => {
      const step = stepsById[stepId];
      const drawingUrl = step?.drawingUrl?.trim();
      const solutionUrl = step?.solutionUrl?.trim();
      if (drawingUrl) {
        registerBoardCapture({
          board: "drawing",
          capturedAt: Date.now(),
          imageUrl: drawingUrl,
          runId,
          stepId,
        });
      }
      if (solutionUrl) {
        registerBoardCapture({
          board: "solution",
          capturedAt: Date.now(),
          imageUrl: solutionUrl,
          runId,
          stepId,
        });
      }
    });
  }, [registerBoardCapture, runtimeKey, stepIds, stepsById]);

  const handleSharedReplayBatchStatus = useCallback((board: "drawing" | "solution", event: ReplayBatchStatusEvent) => {
    if (!runtimeKey) {
      return;
    }
    const batch = useSequenceReplayStore.getState().getBatch(runtimeKey);
    if (!batch || batch.runId !== event.runId) {
      return;
    }

    const isTerminal = registerBoardStatus(event.runId, board, event.status);

    if (
      board === "drawing"
      && event.status === "started"
      && !pendingAccuracyInitializedRunIdsRef.current.has(event.runId)
    ) {
      pendingAccuracyInitializedRunIdsRef.current.add(event.runId);
      setActiveReplayDisplayStep(event.runId, initialStepId);
      useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => ({
        ...current,
        stepAccuraciesByStepId: Object.fromEntries(
          stepIds.map((stepId) => {
            const existing = current.stepAccuraciesByStepId[stepId];
            const hasCurrentRunResult =
              existing?.version === current.drawingVersion
              && typeof existing.accuracy === "number"
              && existing.accuracy >= 0;
            return [
              stepId,
              hasCurrentRunResult
                ? existing
                : { accuracy: -1, version: current.drawingVersion },
            ] as const;
          }),
        ),
      }));
    }

    if (isTerminal) {
      registerFallbackCapturesForMissingComparisons(event.runId);
      maybeFinishReplayRun(event.runId);
      scheduleTerminalReplayFinalize(event.runId);
    }
  }, [
    initialStepId,
    maybeFinishReplayRun,
    registerFallbackCapturesForMissingComparisons,
    registerBoardStatus,
    runtimeKey,
    scheduleTerminalReplayFinalize,
    setActiveReplayDisplayStep,
    stepIds,
  ]);

  const handleDrawingReplayBatchStatus = useCallback((event: ReplayBatchStatusEvent) => {
    handleSharedReplayBatchStatus("drawing", event);
  }, [handleSharedReplayBatchStatus]);

  const handleSolutionReplayBatchStatus = useCallback((event: ReplayBatchStatusEvent) => {
    handleSharedReplayBatchStatus("solution", event);
  }, [handleSharedReplayBatchStatus]);

  const handleDrawingReplayBatchCheckpoint = useCallback((checkpoint: ReplayBatchCheckpoint) => {
    if (!runtimeKey) {
      return;
    }
    commitDrawingCapture({
      stepId: checkpoint.stepId,
      url: checkpoint.dataUrl,
      runId: checkpoint.runId,
    });
    setActiveReplayDisplayStep(checkpoint.runId, checkpoint.stepId);
    const replayProgress = Math.max(stepIds.indexOf(checkpoint.stepId) + 1, 1);
    useSequenceReplayStore.getState().setBatchProgress(
      runtimeKey,
      replayProgress,
      displayStepCount,
    );
    registerBoardCapture({
      board: "drawing",
      capturedAt: Date.now(),
      imageData: checkpoint.imageData,
      imageUrl: checkpoint.dataUrl,
      runId: checkpoint.runId,
      stepId: checkpoint.stepId,
    });
  }, [commitDrawingCapture, displayStepCount, registerBoardCapture, runtimeKey, setActiveReplayDisplayStep, stepIds]);

  const handleSolutionReplayBatchCheckpoint = useCallback((checkpoint: ReplayBatchCheckpoint) => {
    if (!runtimeKey) {
      return;
    }
    commitSolutionCapture({
      stepId: checkpoint.stepId,
      url: checkpoint.dataUrl,
      runId: checkpoint.runId,
      persistPerStep: true,
    });
    setActiveReplayDisplayStep(checkpoint.runId, checkpoint.stepId);
    const replayProgress = Math.max(stepIds.indexOf(checkpoint.stepId) + 1, 1);
    useSequenceReplayStore.getState().setBatchProgress(
      runtimeKey,
      replayProgress,
      displayStepCount,
    );
    registerBoardCapture({
      board: "solution",
      capturedAt: Date.now(),
      imageData: checkpoint.imageData,
      imageUrl: checkpoint.dataUrl,
      runId: checkpoint.runId,
      stepId: checkpoint.stepId,
    });
  }, [commitSolutionCapture, displayStepCount, registerBoardCapture, runtimeKey, setActiveReplayDisplayStep, stepIds]);

  const handleDrawingReplayStatus = useCallback((event: FrameReplayStatusEvent) => {
    if (!runtimeKey) {
      return;
    }
    const batchStore = useEventSequenceReplayBatchStore.getState();
    const uiStore = useEventSequenceReplayUiStore.getState();
    const sequenceReplayStore = useSequenceReplayStore.getState();
    const replayJourneyTotal = displayStepCount;
    const initialOffset = Math.max(displayStepCount - event.totalSteps, 0);

    switch (event.status) {
      case "run-started":
        if (event.totalSteps > 0) {
          batchStore.setReplayBatchSessionProgress(runtimeKey, initialOffset > 0 ? initialOffset : 0, replayJourneyTotal);
        }
        if (replayJourneyTotal > 0) {
          uiStore.setReplayJourneyProgress(runtimeKey, initialOffset > 0 ? initialOffset : 0, replayJourneyTotal);
          sequenceReplayStore.setJourneyProgress(runtimeKey, initialOffset > 0 ? initialOffset : 0, replayJourneyTotal);
        }
        if (event.signature) {
          uiStore.startReplayDiagnostics(runtimeKey, event.signature, event.totalSteps);
          sequenceReplayStore.startDiagnostics(runtimeKey, event.signature, event.totalSteps);
        }
        break;
      case "step-started":
        if (event.stepId) {
          if (replayBatchRunId != null) {
            setActiveReplayDisplayStep(replayBatchRunId, event.stepId);
          }
          uiStore.markReplayStepRunning(runtimeKey, event.stepId, event.selector, event.index);
          sequenceReplayStore.markStepRunning(runtimeKey, event.stepId, event.selector, event.index);
        }
        if (typeof event.index === "number" && event.totalSteps > 0) {
          batchStore.setReplayBatchSessionProgress(
            runtimeKey,
            Math.min(event.index + initialOffset + 0.5, replayJourneyTotal),
            replayJourneyTotal,
          );
        }
        if (typeof event.index === "number" && replayJourneyTotal > 0) {
          uiStore.setReplayJourneyProgress(runtimeKey, Math.min(event.index + initialOffset + 0.5, replayJourneyTotal), replayJourneyTotal);
          sequenceReplayStore.setJourneyProgress(runtimeKey, Math.min(event.index + initialOffset + 0.5, replayJourneyTotal), replayJourneyTotal);
        }
        break;
      case "step-completed":
        if (event.stepId) {
          uiStore.markReplayStepCompleted(runtimeKey, event.stepId, event.selector, event.index);
          sequenceReplayStore.markStepCompleted(runtimeKey, event.stepId, event.selector, event.index);
        }
        if (typeof event.index === "number" && event.totalSteps > 0) {
          batchStore.setReplayBatchSessionProgress(
            runtimeKey,
            Math.min(event.index + initialOffset + 1, replayJourneyTotal),
            replayJourneyTotal,
          );
        }
        if (typeof event.index === "number" && replayJourneyTotal > 0) {
          uiStore.setReplayJourneyProgress(runtimeKey, Math.min(event.index + initialOffset + 1, replayJourneyTotal), replayJourneyTotal);
          sequenceReplayStore.setJourneyProgress(runtimeKey, Math.min(event.index + initialOffset + 1, replayJourneyTotal), replayJourneyTotal);
        }
        break;
      case "step-skipped":
        if (event.stepId) {
          uiStore.markReplayStepSkipped(runtimeKey, event.stepId, event.selector, event.index, event.reason);
          sequenceReplayStore.markStepSkipped(runtimeKey, event.stepId, event.selector, event.index, event.reason);
        }
        if (typeof event.index === "number" && event.totalSteps > 0) {
          batchStore.setReplayBatchSessionProgress(
            runtimeKey,
            Math.min(event.index + initialOffset + 1, replayJourneyTotal),
            replayJourneyTotal,
          );
        }
        if (typeof event.index === "number" && replayJourneyTotal > 0) {
          uiStore.setReplayJourneyProgress(runtimeKey, Math.min(event.index + initialOffset + 1, replayJourneyTotal), replayJourneyTotal);
          sequenceReplayStore.setJourneyProgress(runtimeKey, Math.min(event.index + initialOffset + 1, replayJourneyTotal), replayJourneyTotal);
        }
        break;
      case "run-completed":
        if (event.totalSteps > 0) {
          batchStore.setReplayBatchSessionProgress(runtimeKey, replayJourneyTotal, replayJourneyTotal);
        }
        if (replayJourneyTotal > 0) {
          markReplayJourneyCompleted(runtimeKey, replayJourneyTotal);
        }
        if (event.signature) {
          uiStore.finishReplayDiagnostics(runtimeKey, event.signature);
        }
        break;
      default:
        break;
    }
  }, [displayStepCount, replayBatchRunId, setActiveReplayDisplayStep, runtimeKey]);

  const runtime = useMemo<EventsRuntimeView>(() => ({
    runtimeKey,
    activeRunId: replayBatchRunId,
    activeReplayStepId: replayBatchRunId == null
      ? null
      : (replayActiveStepState.runId === replayBatchRunId ? replayActiveStepState.stepId : null) ?? initialStepId,
    autoReplayRunning: eventSequenceRunActive && Boolean(sequenceRuntime.replayBatchSession),
    selectedStepId,
    displayStepId,
    currentInteractionTriggers,
    batchReplaySequence: selectedScenarioSequence.filter((step) => step.isInitial !== true),
    replayCaptureStepIdsByBoard: replayStepIdsByBoard,
    replaySequence,
    selectedStepRefreshNonce,
    sequenceLength: selectedScenarioSequence.length,
  }), [
    currentInteractionTriggers,
    eventSequenceRunActive,
    initialStepId,
    replayActiveStepState.runId,
    replayActiveStepState.stepId,
    replayBatchRunId,
    replayStepIdsByBoard,
    replaySequence,
    runtimeKey,
    selectedStepRefreshNonce,
    displayStepId,
    selectedScenarioSequence,
    selectedStepId,
    sequenceRuntime.replayBatchSession,
  ]);

  const state = useMemo<EventsStateValue>(() => ({
    selectedStepId,
    displayStepId,
    stepIds,
    stepsById,
    runtime,
  }), [displayStepId, runtime, selectedStepId, stepIds, stepsById]);

  const actions = useMemo<EventsActionsValue>(() => ({
    commitDrawingCapture,
    commitSolutionCapture,
    commitDiffResult,
    setInteractionTriggers: (stepId, triggers) => {
      if (!runtimeKey) {
        return;
      }
      const targetStepId = stepId ?? selectedStepId;
      if (!targetStepId) {
        return;
      }
      useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, targetStepId, {
        interactionTriggers: triggers,
      });
    },
    selectStep: (stepId) => {
      if (!selectedScenario) {
        return;
      }
      const timelineStore = useEventSequenceTimelineUiStore.getState();
      const targetStepId = stepId?.trim() ? stepId : null;
      const currentSelectedStepId = timelineStore.getSelectedStepIdForScenario(
        currentLevel,
        selectedScenario.scenarioId,
      );
      const targetStep = targetStepId ? stepsById[targetStepId] : null;
      const currentRefreshNonce = timelineStore.getSelectedStepRefreshNonceForScenario(
        currentLevel,
        selectedScenario.scenarioId,
      );
      const shouldForceRefresh = Boolean(
        runtimeKey
        && targetStepId
        && (
          currentSelectedStepId === targetStepId
          || targetStep?.drawingStale
          || targetStep?.solutionStale
          || targetStep?.accuracyStale
        ),
      );

      logArtboardReplayDebug("manual-select-step", {
        runtimeKey,
        scenarioId: selectedScenario.scenarioId,
        currentLevel,
        requestedStepId: stepId ?? null,
        targetStepId,
        currentSelectedStepId,
        currentRefreshNonce,
        shouldForceRefresh,
        stepState: targetStep ? {
          drawingStale: targetStep.drawingStale,
          solutionStale: targetStep.solutionStale,
          accuracyStale: targetStep.accuracyStale,
          accuracyStatus: targetStep.accuracyStatus,
          hasDrawingUrl: Boolean(targetStep.drawingUrl?.trim()),
          hasSolutionUrl: Boolean(targetStep.solutionUrl?.trim()),
        } : null,
      });

      timelineStore.setSelectedStep(currentLevel, selectedScenario.scenarioId, targetStepId);

      if (!shouldForceRefresh || !runtimeKey || !targetStepId) {
        return;
      }
      clearDrawboardPixelsForScenario(runtimeKey);
      useEventSequenceCaptureStore.getState().markStepAccuracyPending(runtimeKey, targetStepId);
      timelineStore.bumpSelectedStepRefreshNonce(currentLevel, selectedScenario.scenarioId);
      logArtboardReplayDebug("manual-select-step-refresh-bumped", {
        runtimeKey,
        scenarioId: selectedScenario.scenarioId,
        targetStepId,
        previousRefreshNonce: currentRefreshNonce,
        nextRefreshNonce: currentRefreshNonce + 1,
      });
    },
    handleVerifiedInteraction,
    handleDrawingReplayBatchCheckpoint,
    handleSolutionReplayBatchCheckpoint,
    handleDrawingReplayBatchStatus,
    handleSolutionReplayBatchStatus,
    handleDrawingReplayStatus,
  }), [
    commitDiffResult,
    commitDrawingCapture,
    commitSolutionCapture,
    currentLevel,
    handleDrawingReplayBatchCheckpoint,
    handleDrawingReplayBatchStatus,
    handleDrawingReplayStatus,
    handleSolutionReplayBatchCheckpoint,
    handleSolutionReplayBatchStatus,
    handleVerifiedInteraction,
    selectedScenario,
    selectedStepId,
    stepsById,
    runtimeKey,
  ]);

  const value = useMemo<EventsContextValue>(() => ({ state, actions }), [actions, state]);

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  );
}

function useEventsContext(): EventsContextValue {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error("useEventsContext must be used within EventsProvider");
  }
  return context;
}

export function useEventsState(): EventsStateValue {
  return useEventsContext().state;
}

export function useEventsActions(): EventsActionsValue {
  return useEventsContext().actions;
}
