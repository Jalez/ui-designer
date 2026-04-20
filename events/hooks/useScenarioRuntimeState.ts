"use client";

/**
 * useScenarioRuntimeState — derives scenario-level event-sequence runtime
 * for the currently-selected scenario. Lives inside ScenarioProvider.
 *
 * Covers what used to live in the old EventContext: replay/record/journey
 * state, focused step ids, replay header display, stale step ids, run-control
 * visibility, action handlers.
 */

import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppDispatch } from "@/store/hooks/hooks";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { updateEventSequenceStep } from "@/store/slices/levels.slice";
import {
  EMPTY_REPLAY_DIAGNOSTICS,
  EMPTY_REPLAY_JOURNEY,
  getEventSequenceScenarioUiKey,
  type EventSequenceRecordingMode,
  type ReplayBatchSessionState,
  type ReplayDiagnosticsState,
  type ReplayJourneyState,
} from "@/events/core/eventSequenceReplayTypes";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceRecordingStore } from "@/events/core/eventSequenceRecordingStore";
import { useEventSequenceGameProgressStore } from "@/events/core/eventSequenceGameProgressStore";
import { useEventSequenceAutoRunPrefsStore } from "@/events/core/eventSequenceAutoRunPrefsStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { useEventSequenceRunStore } from "@/events/core/eventSequenceRunStore";
import {
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "@/events/core/eventSequenceCaptureStore";
import { findRunningReplayOnlyStepId } from "@/events/core/replayDiagnostics";
import {
  collectStaleStepIds,
  computeShowEventRunControls,
  resolveEffectiveSelectedSequenceStepId,
  resolveFocusedGameStepId,
  resolveGameActiveStepId,
} from "@/events/core/eventsRuntimeDerived";
import { endReplayBatch } from "@/events/core/eventSequenceFacades";
import type { scenario, EventSequenceStep } from "@/types";
import type { ScenarioAccuracyAggregate } from "@/events/core/aggregateEventSequenceAccuracy";

export type ScenarioRuntimeState = {
  autoReplayOnMount: boolean;
  autoReplayQueued: boolean;
  hasFreshSequenceAccuracy: boolean;
  hasReplayJourneyResult: boolean;
  shouldPromptReplayRerun: boolean;
  shouldShakeManualRun: boolean;
  focusedEventStepId: string | null;
  replayRunningHiddenStepId: string | null;
  effectiveSelectedSequenceStepId: string | null;
  gameActiveStepId: string | null;
  isSequencePanelOpen: boolean;
  selectedRuntimeKey: string | null;
  selectedSequenceStepId: string | null;
  sequenceRuntime: {
    recordingMode: EventSequenceRecordingMode;
    activeIndex: number;
    pendingStepId: string | null;
    replayBatchSession: ReplayBatchSessionState | null;
    replayJourney: ReplayJourneyState;
    replayDiagnostics: ReplayDiagnosticsState;
  };
  replayDiagnostics: ReplayDiagnosticsState;
  replayHeaderState: {
    mode: "idle" | "running" | "completed" | "stale";
    currentStep: number;
    totalSteps: number;
    percent: number;
    label: string;
  };
  showEventRunControls: boolean;
  staleStepIds: Set<string>;
};

export type ScenarioRuntimeActions = {
  handleStartScenarioEventRun: () => void;
  handleStopScenarioEventRun: () => void;
  handleSelectStep: (stepId: string) => void;
  handleUpdateStep: (stepId: string, field: "label" | "instruction", value: string) => void;
};

type UseScenarioRuntimeStateParams = {
  currentLevel: number;
  isCreatorContext: boolean;
  selectedScenario: scenario | null;
  selectedScenarioSequence: EventSequenceStep[];
  scenarioAccuracy: ScenarioAccuracyAggregate;
};

export function useScenarioRuntimeState({
  currentLevel,
  isCreatorContext,
  selectedScenario,
  selectedScenarioSequence,
  scenarioAccuracy,
}: UseScenarioRuntimeStateParams): ScenarioRuntimeState & ScenarioRuntimeActions {
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();

  const selectedScenarioId = selectedScenario?.scenarioId ?? null;
  const selectedRuntimeKey = selectedScenarioId
    ? getEventSequenceScenarioUiKey(currentLevel, selectedScenarioId)
    : null;

  const autoReplayOnMount = useEventSequenceAutoRunPrefsStore((state) => (
    selectedScenarioId ? state.autoReplayOnMountByScenario[`${currentLevel}:${selectedScenarioId}`] ?? false : false
  ));
  const autoReplayQueued = useEventSequenceAutoRunPrefsStore((state) => (
    Boolean(
      selectedScenarioId
      && selectedRuntimeKey
      && state.queuedAutoReplayRequest
      && state.queuedAutoReplayRequest.levelId === currentLevel
      && state.queuedAutoReplayRequest.runtimeKey === selectedRuntimeKey
      && state.queuedAutoReplayRequest.scenarioId === selectedScenarioId,
    )
  ));
  const isSequencePanelOpen = useEventSequenceTimelineUiStore((state) => (
    selectedScenarioId ? state.panelOpenByScenario[`${currentLevel}:${selectedScenarioId}`] ?? false : false
  ));
  const selectedSequenceStepId = useEventSequenceTimelineUiStore((state) => (
    selectedScenarioId ? state.selectedStepIdByScenario[`${currentLevel}:${selectedScenarioId}`] ?? null : null
  ));
  const recordingMode = useEventSequenceRecordingStore((s) => (
    selectedRuntimeKey ? (s.recordingModeByKey[selectedRuntimeKey] ?? "idle") : "idle"
  ));
  const { activeIndex, pendingStepId } = useEventSequenceGameProgressStore(
    useShallow((s) => (
      selectedRuntimeKey
        ? {
          activeIndex: s.activeIndexByKey[selectedRuntimeKey] ?? 0,
          pendingStepId: s.pendingStepIdByKey[selectedRuntimeKey] ?? null,
        }
        : { activeIndex: 0, pendingStepId: null as string | null }
    )),
  );
  const replayBatchSession = useSequenceReplayStore((s) => (
    selectedRuntimeKey ? (s.batchByKey[selectedRuntimeKey] ?? null) : null
  ));
  const replayJourney = useSequenceReplayStore((s) => (
    selectedRuntimeKey ? (s.journeyByKey[selectedRuntimeKey] ?? EMPTY_REPLAY_JOURNEY) : EMPTY_REPLAY_JOURNEY
  ));
  const replayDiagnostics = useSequenceReplayStore((s) => (
    selectedRuntimeKey
      ? (s.diagnosticsByKey[selectedRuntimeKey] ?? EMPTY_REPLAY_DIAGNOSTICS)
      : EMPTY_REPLAY_DIAGNOSTICS
  ));
  const sequenceRuntime = useMemo(
    () => ({ recordingMode, activeIndex, pendingStepId, replayBatchSession, replayJourney, replayDiagnostics }),
    [recordingMode, activeIndex, pendingStepId, replayBatchSession, replayJourney, replayDiagnostics],
  );
  const eventSequenceRunIsActive = useSequenceReplayStore((state) => state.isRunning);
  const sequenceCapture = useEventSequenceCaptureStore((state) => (
    selectCaptureState(state.captureByKey, selectedRuntimeKey)
  ));

  const effectiveSelectedSequenceStepId = resolveEffectiveSelectedSequenceStepId(
    isCreatorContext,
    isSequencePanelOpen,
    selectedSequenceStepId,
  );
  const gameActiveStepId = resolveGameActiveStepId(
    isCreatorContext,
    selectedScenarioSequence,
    sequenceRuntime.activeIndex,
  );
  const replayRunningHiddenStepId = useMemo(
    () => findRunningReplayOnlyStepId(selectedScenarioSequence, sequenceRuntime.replayDiagnostics),
    [selectedScenarioSequence, sequenceRuntime.replayDiagnostics],
  );
  const focusedEventStepId = resolveFocusedGameStepId({
    isCreatorContext,
    isSequencePanelOpen,
    selectedSequenceStepId,
    scenarioSequence: selectedScenarioSequence,
    activeIndex: sequenceRuntime.activeIndex,
  });

  const staleStepIds = useMemo(
    () => collectStaleStepIds(selectedRuntimeKey ?? ""),
    [selectedRuntimeKey, sequenceCapture],
  );

  const hasFreshSequenceAccuracy = scenarioAccuracy.meanKnown && !scenarioAccuracy.stale;
  const hasReplayJourneyResult = sequenceRuntime.replayJourney.lastCompletedAt !== null;
  const shouldPromptReplayRerun = Boolean(
    hasReplayJourneyResult
    && sequenceCapture.lastReplayCompletedDrawingVersion !== null
    && sequenceCapture.drawingVersion > sequenceCapture.lastReplayCompletedDrawingVersion,
  );

  const replayHeaderState = useMemo(() => {
    if (sequenceRuntime.replayJourney.active && sequenceRuntime.replayJourney.totalSteps > 0) {
      const percent = Math.round(
        (sequenceRuntime.replayJourney.currentStep / sequenceRuntime.replayJourney.totalSteps) * 100,
      );
      return {
        mode: "running" as const,
        currentStep: Math.min(
          Math.ceil(sequenceRuntime.replayJourney.currentStep),
          sequenceRuntime.replayJourney.totalSteps,
        ),
        totalSteps: sequenceRuntime.replayJourney.totalSteps,
        percent,
        label: `Running replay ${Math.min(
          Math.ceil(sequenceRuntime.replayJourney.currentStep),
          sequenceRuntime.replayJourney.totalSteps,
        )}/${sequenceRuntime.replayJourney.totalSteps}`,
      };
    }
    if (shouldPromptReplayRerun) {
      return {
        mode: "stale" as const,
        currentStep: sequenceRuntime.replayJourney.totalSteps,
        totalSteps: sequenceRuntime.replayJourney.totalSteps,
        percent: 100,
        label: "Re-run events to update accuracy",
      };
    }
    if (hasReplayJourneyResult && sequenceRuntime.replayJourney.totalSteps > 0) {
      return {
        mode: "completed" as const,
        currentStep: sequenceRuntime.replayJourney.totalSteps,
        totalSteps: sequenceRuntime.replayJourney.totalSteps,
        percent: 100,
        label: `Replay complete ${sequenceRuntime.replayJourney.totalSteps}/${sequenceRuntime.replayJourney.totalSteps}`,
      };
    }
    return {
      mode: "idle" as const,
      currentStep: 0,
      totalSteps: 0,
      percent: 0,
      label: "Events",
    };
  }, [hasReplayJourneyResult, sequenceRuntime.replayJourney, shouldPromptReplayRerun]);

  const showEventRunControls = useMemo(
    () => computeShowEventRunControls(
      selectedScenarioId,
      selectedScenarioSequence.length,
      sequenceRuntime.recordingMode,
      selectedRuntimeKey,
    ),
    [selectedScenarioId, selectedScenarioSequence.length, sequenceRuntime.recordingMode, selectedRuntimeKey],
  );
  const shouldShakeManualRun = showEventRunControls && shouldPromptReplayRerun && !eventSequenceRunIsActive;

  const handleStopScenarioEventRun = useCallback(() => {
    if (!selectedRuntimeKey) return;
    useEventSequenceAutoRunPrefsStore.getState().clearQueuedAutoReplayRequest();
    if (!useEventSequenceRunStore.getState().isRunning) return;
    endReplayBatch(selectedRuntimeKey);
  }, [selectedRuntimeKey]);

  const handleStartScenarioEventRun = useCallback(() => {
    if (!selectedRuntimeKey || !selectedScenario) return;
    if (useEventSequenceRunStore.getState().isRunning) return;
    useEventSequenceAutoRunPrefsStore.getState().queueAutoReplayRequest({
      levelId: currentLevel,
      originalSelectedStepId: useEventSequenceTimelineUiStore
        .getState()
        .getSelectedStepIdForScenario(currentLevel, selectedScenario.scenarioId),
      runtimeKey: selectedRuntimeKey,
      scenarioId: selectedScenario.scenarioId,
      source: "manual",
      totalSteps: selectedScenarioSequence.length + 1,
    });
  }, [currentLevel, selectedRuntimeKey, selectedScenario, selectedScenarioSequence.length]);

  const handleUpdateStep = useCallback((stepId: string, field: "label" | "instruction", value: string) => {
    if (!selectedScenario) return;
    dispatch(updateEventSequenceStep({
      levelId: currentLevel,
      scenarioId: selectedScenario.scenarioId,
      stepId,
      changes: { [field]: value },
    }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
  }, [currentLevel, dispatch, selectedScenario, syncLevelFields]);

  const handleSelectStep = useCallback((stepId: string) => {
    if (!selectedScenario) return;
    useEventSequenceTimelineUiStore.getState().setSelectedStep(currentLevel, selectedScenario.scenarioId, stepId);
  }, [currentLevel, selectedScenario]);

  return {
    autoReplayOnMount,
    autoReplayQueued,
    hasFreshSequenceAccuracy,
    hasReplayJourneyResult,
    shouldPromptReplayRerun,
    shouldShakeManualRun,
    focusedEventStepId,
    replayRunningHiddenStepId,
    effectiveSelectedSequenceStepId: effectiveSelectedSequenceStepId ?? null,
    gameActiveStepId,
    isSequencePanelOpen,
    selectedRuntimeKey,
    selectedSequenceStepId,
    sequenceRuntime,
    replayDiagnostics: sequenceRuntime.replayDiagnostics,
    replayHeaderState,
    showEventRunControls,
    staleStepIds,
    handleStartScenarioEventRun,
    handleStopScenarioEventRun,
    handleSelectStep,
    handleUpdateStep,
  };
}
