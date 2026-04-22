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
import { useAppDispatch, useAppStore } from "@/store/hooks/hooks";
import { addSolutionUrl } from "@/store/slices/solutionUrls.slice";
import { useLevelContext } from "@/components/ArtBoards/LevelContext";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import { useEventsActions, useEventsState } from "@/events/components/EventsContext";
import {
  getEventSequenceScenarioUiKey,
} from "@/events/core/eventSequenceReplayTypes";
import {
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "@/events/core/eventSequenceAccuracyStore";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceRecordingStore } from "@/events/core/eventSequenceRecordingStore";
import { useEventSequenceGameProgressStore } from "@/events/core/eventSequenceGameProgressStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { endReplayBatch, markReplayJourneyCompleted } from "@/events/core/eventSequenceFacades";
import {
  selectBoardFreshnessMap,
  logArtboardReplayDebug,
  selectReplayDisplayState,
  useArtboardReplayRuntimeStore,
} from "@/events/core/artboardReplayRuntimeStore";
import { useEventSequencePreview } from "@/events/hooks/useEventSequencePreview";
import { useSequenceRuntimeLifecycle } from "@/events/hooks/useSequenceRuntimeLifecycle";
import { useStepCompareOrchestration } from "@/events/hooks/useStepCompareOrchestration";
import { useStepPreviewRenderer } from "@/events/hooks/useStepPreviewRenderer";
import { useArtboardReplayBatchDriver } from "@/events/hooks/useArtboardReplayBatchDriver";
import { useReplayComparisonCoordinator } from "@/events/hooks/useReplayComparisonCoordinator";
import {
  buildArtifactKey,
  hashArtifactFingerprint,
  type DrawboardArtifactDescriptor,
} from "@/lib/drawboard/artifactCache";
import { solutionStepArtifactFingerprint } from "@/lib/drawboard/artifactFingerprint";
import {
  getSessionStepDrawingCapture,
  subscribeSessionStepDrawingCaptures,
} from "@/lib/drawboard/drawboardPixelsStore";
import { useScenarioArtifacts } from "@/scenario/hooks/useScenarioArtifacts";
import type { FrameHandle, ReplayBatchCheckpoint, ReplayBatchStatusEvent } from "@/components/ArtBoards/Frame";
import type { InteractionTrigger, EventSequenceStep, VerifiedInteraction, scenario } from "@/types";

export type ArtboardKind = "drawing" | "solution";
export type ArtboardPresentation = "live" | "static" | "diff" | "model";
export type ArtboardStepKey = string;

export type ArtboardStepState = {
  imageUrl: string | null;
  isReady: boolean;
  isStale: boolean;
  lastComputedFingerprint: string | null;
  lastRunId: number | null;
  lastRenderedAt: number | null;
};

export type ArtboardCapabilities = {
  canShowDiff: boolean;
  canShowLive: boolean;
  canShowModel: boolean;
  canShowStatic: boolean;
};

export type ArtboardBoardValue = {
  artifactDescriptor: DrawboardArtifactDescriptor;
  capabilities: ArtboardCapabilities;
  currentImageUrl: string | undefined;
  currentStepId: string;
  eventSequenceStepId: string | null;
  forceEmptyReplaySequence: boolean;
  interactionTriggers: InteractionTrigger[];
  isSequenceRecording: boolean;
  kind: ArtboardKind;
  onFrameReady: (instance: FrameHandle | null) => void;
  onReplayBatchCheckpoint?: (checkpoint: ReplayBatchCheckpoint) => void | Promise<void>;
  onReplayBatchStatus?: (event: ReplayBatchStatusEvent) => void;
  presentation: ArtboardPresentation;
  replaySequence: EventSequenceStep[];
  shouldShowInteractivePreview: boolean;
  solutionArtifactLookupStatus?: "ready" | "loading" | "missing";
  stepStates: Record<ArtboardStepKey, ArtboardStepState>;
};

export type ArtboardRuntimeView = {
  activeRunId: number | null;
  activeReplayStepId: string | null;
  autoReplayRunning: boolean;
  currentSelectedStepId: string;
  sequenceLength: number;
  sessionStepCaptureCacheKey: string;
};

export type ArtboardContextValue = {
  autoReplayRunning: boolean;
  currentDrawingStepId: string;
  drawingArtifactDescriptor: DrawboardArtifactDescriptor;
  drawingBoard: ArtboardBoardValue;
  drawingPresentation: ArtboardPresentation;
  drawingStepStates: Record<ArtboardStepKey, ArtboardStepState>;
  effectiveDrawingUrl: string | undefined;
  frameEvents: InteractionTrigger[];
  isCreator: boolean;
  isSequenceRecording: boolean;
  onFrameReady: (instance: FrameHandle | null) => void;
  onReplayBatchCheckpoint: (checkpoint: ReplayBatchCheckpoint) => void | Promise<void>;
  onReplayBatchStatus: (event: ReplayBatchStatusEvent) => void;
  onVerifiedInteraction: (interaction: VerifiedInteraction) => void;
  replaySequence: EventSequenceStep[];
  runtime: ArtboardRuntimeView;
  sessionStepCaptureCacheKey: string;
  setBoardInteractive: (board: ArtboardKind, enabled: boolean) => void;
  setBoardPresentation: (board: ArtboardKind, presentation: ArtboardPresentation) => void;
  shouldBypassSelectedStepReplay: boolean;
  shouldShowInteractivePreview: boolean;
  solutionBoard: ArtboardBoardValue;
  solutionStepStates: Record<ArtboardStepKey, ArtboardStepState>;
  solutionUrl: string;
};

type ArtboardProviderProps = {
  children: ReactNode;
  gameplaySolutionStepId?: string | null;
  scenario: scenario;
  selectedEventSequenceStepId?: string | null;
  suppressHeavyLayoutEffects?: boolean;
};

const ArtboardContext = createContext<ArtboardContextValue | null>(null);

function getDefaultPresentation(board: ArtboardKind): ArtboardPresentation {
  return board === "drawing" ? "static" : "model";
}

export function ArtboardProvider({
  children,
  gameplaySolutionStepId = null,
  scenario,
  selectedEventSequenceStepId,
  suppressHeavyLayoutEffects = false,
}: ArtboardProviderProps) {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { currentLevel, level } = useLevelContext();
  const { drawboardCaptureMode, canEditCurrentGame } = useGameContext();
  const { showLive } = useGameContext();
  const {
    focusedEventStepId,
    scenarioEventSnapshot,
  } = useScenarioContext();
  const { interactionTriggersByStepId, drawboardUrlByStepId, solutionUrlByStepId } = useEventsState();
  const { setCurrentEventDrawboardUrl, setCurrentEventSolutionUrl, setCurrentInteractionTriggers } = useEventsActions();
  const isCreator = canEditCurrentGame;
  const scenarioSequence = useMemo(
    () => level?.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [],
    [level?.eventSequence, scenario.scenarioId],
  );
  const runtimeKey = useMemo(
    () => getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId),
    [currentLevel, scenario.scenarioId],
  );
  const sequenceCapture = useEventSequenceCaptureStore((state) => (
    selectCaptureState(state.captureByKey, runtimeKey)
  ));
  const eventSequenceRunActive = useSequenceReplayStore((state) => state.isRunning);
  const replayBatchSession = useSequenceReplayStore((state) => state.batchByKey[runtimeKey] ?? null);
  const recordingMode = useEventSequenceRecordingStore((state) => state.recordingModeByKey[runtimeKey] ?? "idle");
  const activeIndex = useEventSequenceGameProgressStore((state) => state.activeIndexByKey[runtimeKey] ?? 0);
  const normalizedActiveIndex = activeIndex >= scenarioSequence.length ? 0 : activeIndex;
  const gameplayActiveSequenceStep = scenarioSequence[normalizedActiveIndex] ?? null;
  const autoReplayRunning = eventSequenceRunActive && Boolean(replayBatchSession);

  const artifacts = useScenarioArtifacts({
    scenario,
    isCreator,
    selectedEventSequenceStepId,
    gameplaySolutionStepId,
    scenarioSequence,
  });

  const {
    replaySequence,
    interactionTriggers: frameEvents,
    shouldShowInteractivePreview,
    isSequenceRecording,
  } = useEventSequencePreview({
    isCreator,
    scenarioSequence,
    selectedEventSequenceStepId,
    recordingMode,
    showLive,
    hasCapture: Boolean(artifacts.drawingUrl),
  });

  const compareSourcesFingerprint = useMemo(
    () =>
      `${artifacts.css}\0${artifacts.html}\0${artifacts.js}\0${scenario.js ?? ""}\0${artifacts.resolvedSolutionCss}\0${artifacts.resolvedSolutionHtml}\0${JSON.stringify(scenarioSequence)}`,
    [artifacts.css, artifacts.html, artifacts.js, artifacts.resolvedSolutionCss, artifacts.resolvedSolutionHtml, scenario.js, scenarioSequence],
  );

  const { handleVerifiedInteraction } = useSequenceRuntimeLifecycle({
    currentLevel,
    level,
    isCreator,
    runtimeKey,
    scenarioSequence,
    sequenceRuntime: { activeIndex, recordingMode },
    drawboardCaptureMode,
    compareSourcesFingerprint,
    suppressHeavyLayoutEffects,
    gameplayActiveSequenceStep,
  });

  useStepCompareOrchestration({
    scenarioSequence,
    runtimeKey,
    isCreator,
    selectedEventSequenceStepId,
    replaySequence,
    gameplayActiveSequenceStep,
    drawboardCaptureMode: artifacts.drawboardCaptureMode,
    suppressSequenceMetrics: suppressHeavyLayoutEffects,
  });

  const handleStepRendered = useCallback((
    stepId: string,
    descriptor: DrawboardArtifactDescriptor,
    dataUrl: string,
  ) => {
    const key = buildArtifactKey(descriptor);
    const existing = (
      (store.getState() as { solutionUrls: Record<string, string | undefined> }).solutionUrls[key] ?? ""
    );
    if (existing.trim()) {
      return;
    }
    dispatch(addSolutionUrl({
      solutionUrl: dataUrl,
      scenarioId: scenario.scenarioId,
      storageKey: key,
      eventSequenceStepId: stepId,
    }));
  }, [dispatch, scenario.scenarioId, store]);

  const isServerCaptureMode = drawboardCaptureMode === "playwright";
  useStepPreviewRenderer({
    scenarioSequence,
    scenarioId: scenario.scenarioId,
    resolvedSolutionCss: artifacts.resolvedSolutionCss,
    resolvedSolutionHtml: artifacts.resolvedSolutionHtml,
    solutionFingerprint: artifacts.solutionFingerprint,
    buildDescriptor: artifacts.buildDescriptor,
    suppressSequenceMetrics: suppressHeavyLayoutEffects || !isServerCaptureMode,
    onStepRendered: handleStepRendered,
  });

  const sessionStepCaptureCacheKey = useMemo(
    () => `${runtimeKey}:${drawboardCaptureMode}:${artifacts.drawingArtifactDescriptor.fingerprint}:${sequenceCapture.drawingVersion}`,
    [artifacts.drawingArtifactDescriptor.fingerprint, drawboardCaptureMode, runtimeKey, sequenceCapture.drawingVersion],
  );

  const initialStepId = scenarioSequence[0]?.id ?? "";
  const selectedDrawingStepId = (() => {
    if (scenarioSequence.length > 0) {
      const scrubbed = selectedEventSequenceStepId?.trim();
      if (scrubbed) return scrubbed;
      if (!isCreator && gameplaySolutionStepId != null) return gameplaySolutionStepId;
      return initialStepId;
    }
    return artifacts.solutionStepIdForCapture ?? initialStepId;
  })();
  const currentEventStepId = focusedEventStepId ?? scenarioEventSnapshot.stepId;
  const currentInteractionTriggers = interactionTriggersByStepId[currentEventStepId] ?? frameEvents;
  const batchVisibleStepIds = useMemo(
    () => scenarioSequence.map((step) => step.id),
    [scenarioSequence],
  );
  const replayBatchRunId = replayBatchSession?.runId ?? null;
  const replayDisplayByKey = useArtboardReplayRuntimeStore((state) => state.displayByKey);
  const freshnessByKey = useArtboardReplayRuntimeStore((state) => state.freshnessByKey);
  const replayDisplay = useMemo(
    () => selectReplayDisplayState(replayDisplayByKey, runtimeKey),
    [replayDisplayByKey, runtimeKey],
  );
  const drawingFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, runtimeKey, "drawing"),
    [freshnessByKey, runtimeKey],
  );
  const solutionFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, runtimeKey, "solution"),
    [freshnessByKey, runtimeKey],
  );
  const activeReplayStepId = replayDisplay.activeStepId;
  const displayedStepId = activeReplayStepId ?? selectedDrawingStepId;
  const currentDrawingStepId = displayedStepId;
  const currentSolutionStepId = artifacts.solutionStepIdForCapture ?? displayedStepId;
  const currentEventDrawboardUrl = drawboardUrlByStepId[currentDrawingStepId] ?? null;
  const currentEventSolutionUrl = solutionUrlByStepId[currentSolutionStepId] ?? null;
  const currentStepSolutionArtifactUrl = artifacts.getStepSolutionUrl(currentSolutionStepId)?.trim() || "";
  const shouldBypassSelectedStepReplay =
    isCreator && !shouldShowInteractivePreview && Boolean(artifacts.drawingUrl ?? currentEventDrawboardUrl);

  useEffect(() => {
    setCurrentInteractionTriggers(frameEvents, currentDrawingStepId);
  }, [currentDrawingStepId, frameEvents, setCurrentInteractionTriggers]);

  const [, setSessionStepCaptureSerial] = useState(0);
  useEffect(() => {
    // Refresh once when the cache key changes so the provider reads the latest capture immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionStepCaptureSerial((value) => value + 1);
    return subscribeSessionStepDrawingCaptures(sessionStepCaptureCacheKey, () => {
      setSessionStepCaptureSerial((value) => value + 1);
    });
  }, [sessionStepCaptureCacheKey]);

  const currentSessionStepCapture = getSessionStepDrawingCapture(sessionStepCaptureCacheKey, currentDrawingStepId);
  const effectiveDrawingUrl = currentSessionStepCapture?.dataUrl ?? artifacts.drawingUrl;
  const effectiveSolutionUrl = currentStepSolutionArtifactUrl || artifacts.solutionUrl?.trim() || undefined;

  useEffect(() => {
    if (!effectiveDrawingUrl) return;
    setCurrentEventDrawboardUrl(effectiveDrawingUrl, currentDrawingStepId);
  }, [currentDrawingStepId, effectiveDrawingUrl, setCurrentEventDrawboardUrl]);

  useEffect(() => {
    const url = effectiveSolutionUrl ?? currentEventSolutionUrl?.trim();
    if (!url) return;
    setCurrentEventSolutionUrl(url, currentSolutionStepId);
  }, [currentEventSolutionUrl, currentSolutionStepId, effectiveSolutionUrl, setCurrentEventSolutionUrl]);

  const replayPrefixByStepId = useMemo(() => {
    const entries: Record<string, string> = {};
    const prefix: string[] = [];
    for (const step of scenarioSequence) {
      prefix.push(step.id);
      entries[step.id] = prefix.join("|");
    }
    return entries;
  }, [scenarioSequence]);

  const drawingFingerprintByStepId = useMemo(
    () => Object.fromEntries(
      batchVisibleStepIds.map((stepId) => [
        stepId,
        `${artifacts.drawingArtifactDescriptor.fingerprint}:${replayPrefixByStepId[stepId] ?? ""}`,
      ]),
    ) as Record<string, string>,
    [artifacts.drawingArtifactDescriptor.fingerprint, batchVisibleStepIds, replayPrefixByStepId],
  );

  const buildSolutionStepFingerprint = useCallback((stepId: string) => {
    if (!artifacts.usePerStepSolutionKeys) {
      return artifacts.solutionFingerprint;
    }
    const comparisonStep = scenarioSequence.find((step) => step.id === stepId) ?? null;
    if (comparisonStep?.isInitial) {
      return hashArtifactFingerprint(["solution-step", artifacts.solutionFingerprint, initialStepId]);
    }
    if (!comparisonStep) {
      return artifacts.solutionFingerprint;
    }
    return solutionStepArtifactFingerprint({
      solutionFingerprint: artifacts.solutionFingerprint,
      step: comparisonStep,
    });
  }, [artifacts.solutionFingerprint, artifacts.usePerStepSolutionKeys, initialStepId, scenarioSequence]);

  const solutionFingerprintByStepId = useMemo(
    () => Object.fromEntries(
      batchVisibleStepIds.map((stepId) => [stepId, buildSolutionStepFingerprint(stepId)]),
    ) as Record<string, string>,
    [batchVisibleStepIds, buildSolutionStepFingerprint],
  );

  const [presentationByBoard, setPresentationByBoard] = useState<Record<ArtboardKind, ArtboardPresentation>>({
    drawing: getDefaultPresentation("drawing"),
    solution: getDefaultPresentation("solution"),
  });
  const [interactiveByBoard, setInteractiveByBoard] = useState<Partial<Record<ArtboardKind, boolean>>>({});
  const stepStatesByBoard = useMemo<Record<ArtboardKind, Record<string, ArtboardStepState>>>(() => ({
    drawing: Object.fromEntries(Object.entries(drawingFreshnessByStep).map(([stepId, value]) => [stepId, {
      imageUrl: value.imageUrl,
      isReady: value.isReady,
      isStale: value.isStale,
      lastComputedFingerprint: value.fingerprint,
      lastRunId: value.lastRunId,
      lastRenderedAt: value.capturedAt,
    }])) as Record<string, ArtboardStepState>,
    solution: Object.fromEntries(Object.entries(solutionFreshnessByStep).map(([stepId, value]) => [stepId, {
      imageUrl: value.imageUrl,
      isReady: value.isReady,
      isStale: value.isStale,
      lastComputedFingerprint: value.fingerprint,
      lastRunId: value.lastRunId,
      lastRenderedAt: value.capturedAt,
    }])) as Record<string, ArtboardStepState>,
  }), [drawingFreshnessByStep, solutionFreshnessByStep]);
  const stepStatesRef = useRef(stepStatesByBoard);
  useEffect(() => {
    stepStatesRef.current = stepStatesByBoard;
  }, [stepStatesByBoard]);

  const updateBoardStepState = useCallback((
    board: ArtboardKind,
    stepId: string,
    recipe: (current: ArtboardStepState) => ArtboardStepState,
  ) => {
    useArtboardReplayRuntimeStore.getState().setBoardStepFreshness(runtimeKey, board, stepId, (current) => {
      const currentArtboardStep: ArtboardStepState = {
        imageUrl: current.imageUrl,
        isReady: current.isReady,
        isStale: current.isStale,
        lastComputedFingerprint: current.fingerprint,
        lastRunId: current.lastRunId,
        lastRenderedAt: current.capturedAt,
      };
      const nextStep = recipe(currentArtboardStep);
      return {
        imageUrl: nextStep.imageUrl,
        fingerprint: nextStep.lastComputedFingerprint,
        capturedAt: nextStep.lastRenderedAt,
        isReady: nextStep.isReady,
        isStale: nextStep.isStale,
        lastRunId: nextStep.lastRunId,
      };
    });
  }, [runtimeKey]);

  const syncBoardImage = useCallback((
    board: ArtboardKind,
    stepId: string,
    imageUrl: string,
    fingerprint: string,
    runId: number | null = null,
    allowFingerprintAdoption = false,
  ) => {
    updateBoardStepState(board, stepId, (current) => {
      const fingerprintChanged = current.lastComputedFingerprint !== fingerprint;
      if (runId == null && !allowFingerprintAdoption && fingerprintChanged) {
        logArtboardReplayDebug("sync-board-image-blocked", {
          board,
          currentFingerprint: current.lastComputedFingerprint,
          currentImageUrl: current.imageUrl,
          incomingFingerprint: fingerprint,
          incomingImageUrl: imageUrl,
          runId,
          stepId,
        });
        return {
          ...current,
          imageUrl: current.imageUrl ?? imageUrl,
          isReady: false,
          isStale: true,
        };
      }
      if (
        current.imageUrl === imageUrl
        && current.lastComputedFingerprint === fingerprint
        && current.lastRunId === runId
        && current.isReady
        && !current.isStale
      ) {
        return current;
      }
      logArtboardReplayDebug("sync-board-image-accepted", {
        allowFingerprintAdoption,
        board,
        fingerprint,
        imageUrl,
        previousFingerprint: current.lastComputedFingerprint,
        previousImageUrl: current.imageUrl,
        runId,
        stepId,
      });
      return {
        imageUrl,
        isReady: true,
        isStale: false,
        lastComputedFingerprint: fingerprint,
        lastRunId: runId,
        lastRenderedAt: Date.now(),
      };
    });
  }, [updateBoardStepState]);

  useEffect(() => {
    const imageUrl = effectiveDrawingUrl?.trim() || currentEventDrawboardUrl?.trim();
    if (!imageUrl) return;
    syncBoardImage(
      "drawing",
      currentDrawingStepId,
      imageUrl,
      drawingFingerprintByStepId[currentDrawingStepId],
      null,
      Boolean(effectiveDrawingUrl?.trim()),
    );
  }, [currentDrawingStepId, currentEventDrawboardUrl, drawingFingerprintByStepId, effectiveDrawingUrl, syncBoardImage]);

  useEffect(() => {
    const imageUrl = effectiveSolutionUrl ?? currentEventSolutionUrl?.trim();
    if (!imageUrl) return;
    syncBoardImage(
      "solution",
      currentSolutionStepId,
      imageUrl,
      solutionFingerprintByStepId[currentSolutionStepId],
      null,
      Boolean(effectiveSolutionUrl),
    );
  }, [currentEventSolutionUrl, currentSolutionStepId, effectiveSolutionUrl, solutionFingerprintByStepId, syncBoardImage]);

  useEffect(() => {
    batchVisibleStepIds.forEach((stepId) => {
      updateBoardStepState("drawing", stepId, (current) => {
        const isStale = Boolean(
          current.lastComputedFingerprint
          && current.lastComputedFingerprint !== drawingFingerprintByStepId[stepId],
        );
        const isReady = Boolean(current.imageUrl) && !isStale;
        if (current.isStale === isStale && current.isReady === isReady) {
          return current;
        }
        return { ...current, isReady, isStale };
      });
      updateBoardStepState("solution", stepId, (current) => {
        const isStale = Boolean(
          current.lastComputedFingerprint
          && current.lastComputedFingerprint !== solutionFingerprintByStepId[stepId],
        );
        const isReady = Boolean(current.imageUrl) && !isStale;
        if (current.isStale === isStale && current.isReady === isReady) {
          return current;
        }
        return { ...current, isReady, isStale };
      });
    });
  }, [batchVisibleStepIds, drawingFingerprintByStepId, solutionFingerprintByStepId, updateBoardStepState]);

  const getBoardFingerprint = useCallback((board: ArtboardKind, stepId: string) => (
    board === "drawing"
      ? drawingFingerprintByStepId[stepId]
      : solutionFingerprintByStepId[stepId]
  ), [drawingFingerprintByStepId, solutionFingerprintByStepId]);

  const getBoardCurrentUrl = useCallback((board: ArtboardKind, stepId: string): string => {
    if (board === "drawing") {
      return (
        stepStatesRef.current.drawing[stepId]?.imageUrl?.trim()
        || drawboardUrlByStepId[stepId]?.trim()
        || (stepId === currentDrawingStepId ? effectiveDrawingUrl?.trim() : "")
        || ""
      );
    }
    return (
      stepStatesRef.current.solution[stepId]?.imageUrl?.trim()
      || solutionUrlByStepId[stepId]?.trim()
      || artifacts.getStepSolutionUrl(stepId)?.trim()
      || ""
    );
  }, [artifacts, currentDrawingStepId, drawboardUrlByStepId, effectiveDrawingUrl, solutionUrlByStepId]);

  const staleStepIdsByBoard = useMemo<Record<ArtboardKind, string[]>>(() => ({
    drawing: batchVisibleStepIds.filter((stepId) => {
      const state = stepStatesByBoard.drawing[stepId];
      return !state?.imageUrl || state.isStale || state.lastComputedFingerprint !== drawingFingerprintByStepId[stepId];
    }),
    solution: batchVisibleStepIds.filter((stepId) => {
      const state = stepStatesByBoard.solution[stepId];
      return !state?.imageUrl || state.isStale || state.lastComputedFingerprint !== solutionFingerprintByStepId[stepId];
    }),
  }), [batchVisibleStepIds, drawingFingerprintByStepId, solutionFingerprintByStepId, stepStatesByBoard.drawing, stepStatesByBoard.solution]);

  const replayStepIdsByBoard = useMemo<Record<ArtboardKind, string[]>>(() => ({
    drawing: staleStepIdsByBoard.drawing,
    solution: staleStepIdsByBoard.solution,
  }), [staleStepIdsByBoard.drawing, staleStepIdsByBoard.solution]);

  const { clearRun, registerBoardCapture } = useReplayComparisonCoordinator({
    dispatch,
    runtimeKey,
    scenarioDimensions: scenario.dimensions,
    scenarioId: scenario.scenarioId,
  });
  const initializedReplayRunIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!replayBatchRunId) {
      initializedReplayRunIdRef.current = null;
      return;
    }
    if (initializedReplayRunIdRef.current === replayBatchRunId) {
      return;
    }
    initializedReplayRunIdRef.current = replayBatchRunId;
    useArtboardReplayRuntimeStore.getState().startRun(
      runtimeKey,
      replayBatchRunId,
      selectedDrawingStepId,
      initialStepId,
    );
    clearRun(replayBatchRunId);
    batchVisibleStepIds.forEach((stepId) => {
      (["drawing", "solution"] as const).forEach((board) => {
        if (stepId === initialStepId) {
          return;
        }
        const currentState = stepStatesRef.current[board][stepId];
        const imageUrl = getBoardCurrentUrl(board, stepId);
        const fingerprint = getBoardFingerprint(board, stepId);
        const isFresh = Boolean(imageUrl)
          && currentState?.lastComputedFingerprint === fingerprint
          && !currentState?.isStale;
        if (!isFresh) {
          return;
        }
        registerBoardCapture({
          board,
          capturedAt: currentState?.lastRenderedAt ?? Date.now(),
          fingerprint,
          imageUrl,
          runId: replayBatchRunId,
          stepId,
        });
      });
    });
    const drawingDone = replayStepIdsByBoard.drawing.length === 0
      ? useArtboardReplayRuntimeStore.getState().registerBoardStatus(runtimeKey, replayBatchRunId, "drawing", "completed")
      : false;
    const solutionDone = replayStepIdsByBoard.solution.length === 0
      ? useArtboardReplayRuntimeStore.getState().registerBoardStatus(runtimeKey, replayBatchRunId, "solution", "completed")
      : false;
    if (drawingDone || solutionDone) {
      markReplayJourneyCompleted(runtimeKey, batchVisibleStepIds.length);
      useSequenceReplayStore.getState().setBatchProgress(
        runtimeKey,
        batchVisibleStepIds.length,
        batchVisibleStepIds.length,
      );
      useEventSequenceTimelineUiStore.getState().setSelectedStep(
        currentLevel,
        scenario.scenarioId,
        selectedDrawingStepId,
      );
      endReplayBatch(runtimeKey);
      useArtboardReplayRuntimeStore.getState().finishReplayRun(runtimeKey, replayBatchRunId);
      clearRun(replayBatchRunId);
    }
  }, [batchVisibleStepIds, clearRun, currentLevel, getBoardCurrentUrl, getBoardFingerprint, initialStepId, registerBoardCapture, replayBatchRunId, replayStepIdsByBoard.drawing.length, replayStepIdsByBoard.solution.length, runtimeKey, scenario.scenarioId, selectedDrawingStepId]);

  const drawingDriver = useArtboardReplayBatchDriver({
    batchVisibleStepIds: replayStepIdsByBoard.drawing,
    enabled: !suppressHeavyLayoutEffects && eventSequenceRunActive,
    replayBatchSession,
    scenarioSequence: scenarioSequence,
  });
  const solutionDriver = useArtboardReplayBatchDriver({
    batchVisibleStepIds: replayStepIdsByBoard.solution,
    enabled: !suppressHeavyLayoutEffects && eventSequenceRunActive,
    replayBatchSession,
    scenarioSequence: scenarioSequence,
  });

  const handleSharedReplayBatchStatus = useCallback((board: ArtboardKind, event: ReplayBatchStatusEvent) => {
    const batch = useSequenceReplayStore.getState().getBatch(runtimeKey);
    if (!batch || batch.runId !== event.runId) {
      return;
    }

    const isTerminal = useArtboardReplayRuntimeStore.getState().registerBoardStatus(
      runtimeKey,
      event.runId,
      board,
      event.status,
    );

    if (board === "drawing" && event.status === "started") {
      useArtboardReplayRuntimeStore.getState().setActiveReplayDisplayStep(
        runtimeKey,
        event.runId,
        initialStepId,
      );
      useEventSequenceCaptureStore.getState().updateCaptureState(runtimeKey, (current) => ({
        ...current,
        stepAccuraciesByStepId: Object.fromEntries(
          batchVisibleStepIds.map((stepId) => [
            stepId,
            { accuracy: -1, version: current.drawingVersion },
          ] as const),
        ),
      }));
    }

    if (isTerminal) {
      if (event.status === "completed") {
        markReplayJourneyCompleted(runtimeKey, batchVisibleStepIds.length);
      }
      if (event.status === "completed") {
        useSequenceReplayStore.getState().setBatchProgress(
          runtimeKey,
          batchVisibleStepIds.length,
          batchVisibleStepIds.length,
        );
      }
      useEventSequenceTimelineUiStore.getState().setSelectedStep(
        currentLevel,
        scenario.scenarioId,
        batch.originalSelectedStepId,
      );
      endReplayBatch(runtimeKey);
      useArtboardReplayRuntimeStore.getState().finishReplayRun(runtimeKey, event.runId);
      clearRun(event.runId);
    }
  }, [batchVisibleStepIds, clearRun, currentLevel, initialStepId, runtimeKey, scenario.scenarioId]);

  const handleDrawingReplayBatchStatus = useCallback((event: ReplayBatchStatusEvent) => {
    handleSharedReplayBatchStatus("drawing", event);
  }, [handleSharedReplayBatchStatus]);

  const handleSolutionReplayBatchStatus = useCallback((event: ReplayBatchStatusEvent) => {
    handleSharedReplayBatchStatus("solution", event);
  }, [handleSharedReplayBatchStatus]);

  const handleDrawingReplayBatchCheckpoint = useCallback((checkpoint: ReplayBatchCheckpoint) => {
    const fingerprint = drawingFingerprintByStepId[checkpoint.stepId];
    syncBoardImage("drawing", checkpoint.stepId, checkpoint.dataUrl, fingerprint, checkpoint.runId);
    setCurrentEventDrawboardUrl(checkpoint.dataUrl, checkpoint.stepId);
    useArtboardReplayRuntimeStore.getState().setActiveReplayDisplayStep(
      runtimeKey,
      checkpoint.runId,
      checkpoint.stepId,
    );
    useSequenceReplayStore.getState().setBatchProgress(
      runtimeKey,
      batchVisibleStepIds.indexOf(checkpoint.stepId) + 1,
      batchVisibleStepIds.length,
    );
    registerBoardCapture({
      board: "drawing",
      capturedAt: Date.now(),
      fingerprint,
      imageData: checkpoint.imageData,
      imageUrl: checkpoint.dataUrl,
      runId: checkpoint.runId,
      stepId: checkpoint.stepId,
    });
  }, [
    batchVisibleStepIds,
    drawingFingerprintByStepId,
    registerBoardCapture,
    runtimeKey,
    setCurrentEventDrawboardUrl,
    syncBoardImage,
  ]);

  const handleSolutionReplayBatchCheckpoint = useCallback((checkpoint: ReplayBatchCheckpoint) => {
    const fingerprint = solutionFingerprintByStepId[checkpoint.stepId] ?? buildSolutionStepFingerprint(checkpoint.stepId);
    const descriptor = artifacts.buildDescriptor(
      artifacts.usePerStepSolutionKeys ? "solution-step" : "solution",
      fingerprint,
      artifacts.usePerStepSolutionKeys ? checkpoint.stepId : null,
    );
    dispatch(addSolutionUrl({
      solutionUrl: checkpoint.dataUrl,
      scenarioId: scenario.scenarioId,
      storageKey: buildArtifactKey(descriptor),
      eventSequenceStepId: checkpoint.stepId,
    }));
    setCurrentEventSolutionUrl(checkpoint.dataUrl, checkpoint.stepId);
    useArtboardReplayRuntimeStore.getState().setActiveReplayDisplayStep(
      runtimeKey,
      checkpoint.runId,
      checkpoint.stepId,
    );
    useSequenceReplayStore.getState().setBatchProgress(
      runtimeKey,
      batchVisibleStepIds.indexOf(checkpoint.stepId) + 1,
      batchVisibleStepIds.length,
    );
    syncBoardImage("solution", checkpoint.stepId, checkpoint.dataUrl, fingerprint, checkpoint.runId);
    registerBoardCapture({
      board: "solution",
      capturedAt: Date.now(),
      fingerprint,
      imageData: checkpoint.imageData,
      imageUrl: checkpoint.dataUrl,
      runId: checkpoint.runId,
      stepId: checkpoint.stepId,
    });
  }, [
    artifacts,
    buildSolutionStepFingerprint,
    dispatch,
    registerBoardCapture,
    runtimeKey,
    batchVisibleStepIds,
    scenario.scenarioId,
    setCurrentEventSolutionUrl,
    solutionFingerprintByStepId,
    syncBoardImage,
  ]);

  const setBoardPresentation = useCallback((board: ArtboardKind, presentation: ArtboardPresentation) => {
    logArtboardReplayDebug("set-board-presentation", {
      board,
      nextPresentation: presentation,
      previousPresentation: presentationByBoard[board],
      runtimeKey,
    });
    setPresentationByBoard((current) => (
      current[board] === presentation ? current : { ...current, [board]: presentation }
    ));
  }, [presentationByBoard, runtimeKey]);

  const setBoardInteractive = useCallback((board: ArtboardKind, enabled: boolean) => {
    setInteractiveByBoard((current) => (
      current[board] === enabled ? current : { ...current, [board]: enabled }
    ));
  }, []);

  const drawingCanShowLive = isCreator || artifacts.interactive;
  const solutionCanShowLive = isCreator;
  const drawingPresentation = presentationByBoard.drawing;
  const solutionPresentation = presentationByBoard.solution;
  const drawingInteractivePreview = drawingCanShowLive && (interactiveByBoard.drawing ?? shouldShowInteractivePreview);
  const solutionInteractivePreview = solutionCanShowLive
    && (interactiveByBoard.solution ?? shouldShowInteractivePreview);

  const drawingBoard = useMemo<ArtboardBoardValue>(() => {
    const currentStepState = stepStatesByBoard.drawing[currentDrawingStepId];
    const currentImageUrl = autoReplayRunning
      ? currentStepState?.imageUrl ?? undefined
      : (!currentStepState?.isStale ? currentStepState?.imageUrl : undefined) ?? effectiveDrawingUrl ?? currentEventDrawboardUrl;
    return {
      kind: "drawing",
      artifactDescriptor: artifacts.drawingArtifactDescriptor,
      capabilities: {
        canShowDiff: true,
        canShowLive: drawingCanShowLive,
        canShowModel: false,
        canShowStatic: true,
      },
      currentImageUrl,
      currentStepId: currentDrawingStepId,
      eventSequenceStepId: currentDrawingStepId,
      forceEmptyReplaySequence: isCreator
        ? autoReplayRunning || shouldBypassSelectedStepReplay
        : autoReplayRunning,
      interactionTriggers: currentInteractionTriggers,
      isSequenceRecording,
      onFrameReady: drawingDriver.handleFrameReady,
      onReplayBatchCheckpoint: handleDrawingReplayBatchCheckpoint,
      onReplayBatchStatus: handleDrawingReplayBatchStatus,
      presentation: drawingPresentation,
      replaySequence,
      shouldShowInteractivePreview: drawingInteractivePreview,
      stepStates: stepStatesByBoard.drawing,
    };
  }, [
    artifacts.drawingArtifactDescriptor,
    autoReplayRunning,
    currentDrawingStepId,
    currentEventDrawboardUrl,
    currentInteractionTriggers,
    drawingCanShowLive,
    drawingInteractivePreview,
    drawingPresentation,
    effectiveDrawingUrl,
    drawingDriver.handleFrameReady,
    handleDrawingReplayBatchCheckpoint,
    handleDrawingReplayBatchStatus,
    isCreator,
    isSequenceRecording,
    replaySequence,
    shouldBypassSelectedStepReplay,
    stepStatesByBoard.drawing,
  ]);

  useEffect(() => {
    logArtboardReplayDebug("drawing-board-source", {
      autoReplayRunning,
      currentEventDrawboardUrl,
      currentImageUrl: drawingBoard.currentImageUrl ?? null,
      currentStepId: currentDrawingStepId,
      effectiveDrawingUrl: effectiveDrawingUrl ?? null,
      presentation: drawingPresentation,
      runtimeKey,
      stateFingerprint: stepStatesByBoard.drawing[currentDrawingStepId]?.lastComputedFingerprint ?? null,
      stateImageUrl: stepStatesByBoard.drawing[currentDrawingStepId]?.imageUrl ?? null,
      stateIsReady: stepStatesByBoard.drawing[currentDrawingStepId]?.isReady ?? false,
      stateIsStale: stepStatesByBoard.drawing[currentDrawingStepId]?.isStale ?? false,
    });
  }, [
    autoReplayRunning,
    currentDrawingStepId,
    currentEventDrawboardUrl,
    drawingBoard.currentImageUrl,
    drawingPresentation,
    effectiveDrawingUrl,
    runtimeKey,
    stepStatesByBoard.drawing,
  ]);

  const currentSolutionStepState = stepStatesByBoard.solution[currentSolutionStepId];
  const currentSolutionUrl = autoReplayRunning
    ? currentSolutionStepState?.imageUrl ?? ""
    : (!currentSolutionStepState?.isStale ? currentSolutionStepState?.imageUrl : undefined)
      ?? effectiveSolutionUrl
      ?? currentEventSolutionUrl
      ?? solutionUrlByStepId[currentSolutionStepId]
      ?? "";
  const solutionLookupStatus: "ready" | "loading" | "missing" = currentSolutionUrl?.trim()
    ? "ready"
    : autoReplayRunning || solutionInteractivePreview
      ? "loading"
      : "missing";

  const solutionBoard = useMemo<ArtboardBoardValue>(() => ({
    kind: "solution",
    artifactDescriptor: artifacts.solutionArtifactDescriptor,
    capabilities: {
      canShowDiff: true,
      canShowLive: solutionCanShowLive,
      canShowModel: true,
      canShowStatic: true,
    },
    currentImageUrl: currentSolutionUrl || undefined,
    currentStepId: currentSolutionStepId,
    eventSequenceStepId: currentSolutionStepId,
    forceEmptyReplaySequence: autoReplayRunning,
    interactionTriggers: currentInteractionTriggers,
    isSequenceRecording: isSequenceRecording || recordingMode !== "idle",
    onFrameReady: solutionDriver.handleFrameReady,
    onReplayBatchCheckpoint: handleSolutionReplayBatchCheckpoint,
    onReplayBatchStatus: handleSolutionReplayBatchStatus,
    presentation: solutionPresentation,
    replaySequence,
    shouldShowInteractivePreview: solutionInteractivePreview,
    solutionArtifactLookupStatus: solutionLookupStatus,
    stepStates: stepStatesByBoard.solution,
  }), [
    artifacts.solutionArtifactDescriptor,
    autoReplayRunning,
    currentInteractionTriggers,
    currentSolutionStepId,
    currentSolutionUrl,
    solutionDriver.handleFrameReady,
    handleSolutionReplayBatchCheckpoint,
    handleSolutionReplayBatchStatus,
    isSequenceRecording,
    recordingMode,
    replaySequence,
    solutionCanShowLive,
    solutionInteractivePreview,
    solutionLookupStatus,
    solutionPresentation,
    stepStatesByBoard.solution,
  ]);

  useEffect(() => {
    logArtboardReplayDebug("solution-board-source", {
      autoReplayRunning,
      currentEventSolutionUrl,
      currentImageUrl: currentSolutionUrl || null,
      currentStepId: currentSolutionStepId,
      effectiveSolutionUrl: effectiveSolutionUrl ?? null,
      presentation: solutionPresentation,
      runtimeKey,
      stateFingerprint: currentSolutionStepState?.lastComputedFingerprint ?? null,
      stateImageUrl: currentSolutionStepState?.imageUrl ?? null,
      stateIsReady: currentSolutionStepState?.isReady ?? false,
      stateIsStale: currentSolutionStepState?.isStale ?? false,
    });
  }, [
    autoReplayRunning,
    currentEventSolutionUrl,
    currentSolutionStepId,
    currentSolutionStepState,
    currentSolutionUrl,
    effectiveSolutionUrl,
    runtimeKey,
    solutionPresentation,
  ]);

  const runtime = useMemo<ArtboardRuntimeView>(() => ({
    activeRunId: replayDisplay.activeRunId,
    activeReplayStepId,
    autoReplayRunning,
    currentSelectedStepId: selectedDrawingStepId,
    sequenceLength: scenarioSequence.length,
    sessionStepCaptureCacheKey,
  }), [replayDisplay.activeRunId, activeReplayStepId, autoReplayRunning, scenarioSequence.length, selectedDrawingStepId, sessionStepCaptureCacheKey]);

  const contextValue = useMemo<ArtboardContextValue>(() => ({
    autoReplayRunning,
    currentDrawingStepId,
    drawingArtifactDescriptor: artifacts.drawingArtifactDescriptor,
    drawingBoard,
    drawingPresentation,
    drawingStepStates: stepStatesByBoard.drawing,
    effectiveDrawingUrl: drawingBoard.currentImageUrl,
    frameEvents: currentInteractionTriggers,
    isCreator,
    isSequenceRecording,
    onFrameReady: drawingDriver.handleFrameReady,
    onReplayBatchCheckpoint: handleDrawingReplayBatchCheckpoint,
    onReplayBatchStatus: handleDrawingReplayBatchStatus,
    onVerifiedInteraction: handleVerifiedInteraction,
    replaySequence,
    runtime,
    sessionStepCaptureCacheKey,
    setBoardInteractive,
    setBoardPresentation,
    shouldBypassSelectedStepReplay,
    shouldShowInteractivePreview: drawingInteractivePreview,
    solutionBoard,
    solutionStepStates: stepStatesByBoard.solution,
    solutionUrl: currentSolutionUrl || "",
  }), [
    autoReplayRunning,
    artifacts.drawingArtifactDescriptor,
    currentDrawingStepId,
    currentInteractionTriggers,
    currentSolutionUrl,
    drawingBoard,
    drawingInteractivePreview,
    drawingPresentation,
    drawingDriver.handleFrameReady,
    handleDrawingReplayBatchCheckpoint,
    handleDrawingReplayBatchStatus,
    handleVerifiedInteraction,
    isCreator,
    isSequenceRecording,
    replaySequence,
    runtime,
    sessionStepCaptureCacheKey,
    setBoardInteractive,
    setBoardPresentation,
    shouldBypassSelectedStepReplay,
    solutionBoard,
    stepStatesByBoard.drawing,
    stepStatesByBoard.solution,
  ]);

  return (
    <ArtboardContext.Provider value={contextValue}>
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
