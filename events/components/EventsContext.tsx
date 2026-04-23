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
import {
  getLatestUsableReplayComparisonResultForStep,
  selectBoardFreshnessMap,
  useArtboardReplayRuntimeStore,
} from "@/events/core/artboardReplayRuntimeStore";
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
  replaySequence: EventSequenceStep[];
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
  const { currentLevel, level } = useLevelContext();
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
    scenarioScopeKey,
    selectedScenario,
    selectedScenarioSequence,
    sequenceRuntime,
    staleStepIds,
  } = useScenarioContext();

  const isCreator = canEditCurrentGame;
  const runtimeKey = scenarioScopeKey;
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

  const compareSourcesFingerprint = useMemo(
    () =>
      `${level?.code.css ?? ""}\0${level?.code.html ?? ""}\0${level?.code.js ?? ""}\0${selectedScenario?.js ?? ""}\0${level?.solution?.css ?? ""}\0${level?.solution?.html ?? ""}\0${JSON.stringify(selectedScenarioSequence)}`,
    [
      level?.code.css,
      level?.code.html,
      level?.code.js,
      level?.solution?.css,
      level?.solution?.html,
      selectedScenario?.js,
      selectedScenarioSequence,
    ],
  );

  const { handleVerifiedInteraction } = useSequenceRuntimeLifecycle({
    currentLevel,
    level,
    isCreator,
    runtimeKey: runtimeKey ?? "",
    scenarioSequence: selectedScenarioSequence,
    sequenceRuntime: {
      activeIndex: sequenceRuntime.activeIndex,
      recordingMode,
    },
    compareSourcesFingerprint,
    suppressHeavyLayoutEffects: false,
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

  const commitDrawingCapture = useCallback((input: CaptureCommitInput) => {
    if (!selectedScenario || !runtimeKey || !input.url) {
      return;
    }
    const targetStepId = input.stepId ?? displayStepId;
    if (!targetStepId) {
      return;
    }
    useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, targetStepId, {
      drawingUrl: input.url,
    });
    updateBoardFreshness("drawing", targetStepId, input.url, input.runId ?? null);
    if (input.persistScenarioUrl) {
      dispatch(addDrawingUrl({
        drawingUrl: input.url,
        scenarioId: selectedScenario.scenarioId,
      }));
    }
  }, [
    dispatch,
    displayStepId,
    runtimeKey,
    selectedScenario,
    updateBoardFreshness,
  ]);

  const commitSolutionCapture = useCallback((input: CaptureCommitInput) => {
    if (!runtimeKey || !input.url) {
      return;
    }
    const targetStepId = input.stepId ?? displayStepId;
    if (!targetStepId) {
      return;
    }
    useEventStepRuntimeStore.getState().mergeStepRuntime(runtimeKey, targetStepId, {
      solutionUrl: input.url,
    });
    updateBoardFreshness("solution", targetStepId, input.url, input.runId ?? null);
  }, [
    displayStepId,
    runtimeKey,
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

  const getBoardCurrentUrl = useCallback((board: "drawing" | "solution", stepId: string): string => {
    const step = stepsById[stepId];
    if (!step) {
      return "";
    }
    return board === "drawing"
      ? step.drawingUrl?.trim() ?? ""
      : step.solutionUrl?.trim() ?? "";
  }, [stepsById]);

  const replayStepIdsByBoard = useMemo(() => ({
    drawing: stepIds.filter((stepId) => !stepsById[stepId]?.drawingUrl),
    solution: stepIds.filter((stepId) => !stepsById[stepId]?.solutionUrl),
  }), [stepIds, stepsById]);

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

  const { clearRun, registerBoardCapture } = useReplayComparisonCoordinator({
    runtimeKey: runtimeKey ?? "",
    scenarioDimensions: selectedScenario?.dimensions ?? { width: 0, height: 0 },
  });

  const boardRunStatusRef = useRef<{
    runId: number | null;
    drawing?: "started" | "completed" | "cancelled" | "failed";
    solution?: "started" | "completed" | "cancelled" | "failed";
  }>({ runId: null });

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

  const queuedStaleReplaySignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!staleReplaySignature) {
      queuedStaleReplaySignatureRef.current = null;
      return;
    }
    if (!runtimeKey || !selectedScenario || !selectedScenarioSequence.length || recordingMode !== "idle" || eventSequenceRunActive) {
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
    eventSequenceRunActive,
    recordingMode,
    runtimeKey,
    selectedScenario,
    selectedScenarioSequence.length,
    staleReplaySignature,
    initialStepId,
    displayStepCount,
  ]);

  const initializedReplayRunIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!runtimeKey) {
      initializedReplayRunIdRef.current = null;
      return;
    }
    if (!replayBatchRunId) {
      initializedReplayRunIdRef.current = null;
      return;
    }
    if (initializedReplayRunIdRef.current === replayBatchRunId) {
      return;
    }
    initializedReplayRunIdRef.current = replayBatchRunId;
    clearRun(replayBatchRunId);

    stepIds.forEach((stepId) => {
      (["drawing", "solution"] as const).forEach((board) => {
        if (stepId === initialStepId) {
          return;
        }
        const imageUrl = getBoardCurrentUrl(board, stepId);
        if (!imageUrl) {
          return;
        }
        registerBoardCapture({
          board,
          capturedAt: Date.now(),
          imageUrl,
          runId: replayBatchRunId,
          stepId,
        });
      });
    });

    const drawingDone = replayStepIdsByBoard.drawing.length === 0
      ? registerBoardStatus(replayBatchRunId, "drawing", "completed")
      : false;
    const solutionDone = replayStepIdsByBoard.solution.length === 0
      ? registerBoardStatus(replayBatchRunId, "solution", "completed")
      : false;

    if (drawingDone || solutionDone) {
      markReplayJourneyCompleted(runtimeKey, displayStepCount);
      useSequenceReplayStore.getState().setBatchProgress(runtimeKey, displayStepCount, displayStepCount);
      endReplayBatch(runtimeKey);
      clearRun(replayBatchRunId);
    }
  }, [
    clearRun,
    getBoardCurrentUrl,
    initialStepId,
    registerBoardCapture,
    registerBoardStatus,
    replayBatchRunId,
    replayStepIdsByBoard.drawing.length,
    replayStepIdsByBoard.solution.length,
    runtimeKey,
    displayStepCount,
    stepIds,
  ]);

  const handleSharedReplayBatchStatus = useCallback((board: "drawing" | "solution", event: ReplayBatchStatusEvent) => {
    if (!runtimeKey) {
      return;
    }
    const batch = useSequenceReplayStore.getState().getBatch(runtimeKey);
    if (!batch || batch.runId !== event.runId) {
      return;
    }

    const isTerminal = registerBoardStatus(event.runId, board, event.status);

    if (board === "drawing" && event.status === "started") {
      setActiveReplayDisplayStep(event.runId, initialStepId);
      useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => ({
        ...current,
        stepAccuraciesByStepId: Object.fromEntries(
          stepIds.map((stepId) => [
            stepId,
            { accuracy: -1, version: current.drawingVersion },
          ] as const),
        ),
      }));
    }

    if (isTerminal) {
      if (event.status === "completed") {
        markReplayJourneyCompleted(runtimeKey, displayStepCount);
        useSequenceReplayStore.getState().setBatchProgress(runtimeKey, displayStepCount, displayStepCount);
      }
      endReplayBatch(runtimeKey);
      clearRun(event.runId);
    }
  }, [
    clearRun,
    initialStepId,
    registerBoardStatus,
    runtimeKey,
    setActiveReplayDisplayStep,
    displayStepCount,
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
  }, [displayStepCount, runtimeKey]);

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
    replaySequence,
    sequenceLength: selectedScenarioSequence.length,
  }), [
    currentInteractionTriggers,
    eventSequenceRunActive,
    initialStepId,
    replayActiveStepState.runId,
    replayActiveStepState.stepId,
    replayBatchRunId,
    replaySequence,
    runtimeKey,
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
      useEventSequenceTimelineUiStore.getState().setSelectedStep(
        currentLevel,
        selectedScenario.scenarioId,
        stepId,
      );
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
