"use client";

/**
 * useScenarioRuntimeReadModel — pure derivation of scenario-level
 * event-sequence runtime state for the currently-selected scenario.
 *
 * Reads from replay / recording / progress / auto-run / timeline-ui / capture
 * stores and composes runtime view fields (focused ids, header state, stale
 * step ids, etc.). Holds no side effects and exposes no mutators. Actions
 * live in `useScenarioRuntimeActions`.
 */

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
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
import {
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "@/events/core/eventSequenceAccuracyStore";
import { findRunningReplayOnlyStepId } from "@/events/core/replayDiagnostics";
import {
  collectStaleStepIds,
  computeShowEventRunControls,
  resolveEffectiveSelectedSequenceStepId,
  resolveFocusedGameStepId,
  resolveGameActiveStepId,
} from "@/events/core/eventsRuntimeDerived";
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

type UseScenarioRuntimeReadModelParams = {
  currentLevel: number;
  isCreatorRoute: boolean;
  selectedScenario: scenario | null;
  selectedScenarioSequence: EventSequenceStep[];
  scenarioAccuracy: ScenarioAccuracyAggregate;
};

export function useScenarioRuntimeReadModel({
  currentLevel,
  isCreatorRoute,
  selectedScenario,
  selectedScenarioSequence,
  scenarioAccuracy,
}: UseScenarioRuntimeReadModelParams): ScenarioRuntimeState {
  const selectedScenarioId = selectedScenario?.scenarioId ?? null;
  const selectedRuntimeKey = selectedScenarioId
    ? getEventSequenceScenarioUiKey(currentLevel, selectedScenarioId)
    : null;

  const autoReplayOnMount = useEventSequenceAutoRunPrefsStore((state) => (
    selectedScenarioId ? state.autoReplayOnMountByScenario[`${currentLevel}:${selectedScenarioId}`] ?? true : false
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
    isCreatorRoute,
    isSequencePanelOpen,
    selectedSequenceStepId,
  );
  const gameActiveStepId = resolveGameActiveStepId(
    isCreatorRoute,
    selectedScenarioSequence,
    sequenceRuntime.activeIndex,
  );
  const replayRunningHiddenStepId = useMemo(
    () => findRunningReplayOnlyStepId(selectedScenarioSequence, sequenceRuntime.replayDiagnostics),
    [selectedScenarioSequence, sequenceRuntime.replayDiagnostics],
  );
  const focusedEventStepId = resolveFocusedGameStepId({
    isCreatorRoute,
    isSequencePanelOpen,
    selectedSequenceStepId,
    scenarioSequence: selectedScenarioSequence,
    activeIndex: sequenceRuntime.activeIndex,
  });

  const staleStepIds = useMemo(
    () => {
      void sequenceCapture;
      return collectStaleStepIds(selectedRuntimeKey ?? "");
    },
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
    if (sequenceRuntime.replayBatchSession && sequenceRuntime.replayBatchSession.totalSteps > 0) {
      const totalSteps = sequenceRuntime.replayBatchSession.totalSteps;
      const currentStep = Math.min(
        Math.max(1, Math.ceil(sequenceRuntime.replayBatchSession.stepIndex)),
        totalSteps,
      );
      const percent = Math.round((currentStep / totalSteps) * 100);
      return {
        mode: "running" as const,
        currentStep,
        totalSteps,
        percent,
        label: `Running replay ${currentStep}/${totalSteps}`,
      };
    }
    if (sequenceRuntime.replayJourney.active && sequenceRuntime.replayJourney.totalSteps > 0) {
      const totalSteps = sequenceRuntime.replayJourney.totalSteps;
      const currentStep = Math.min(
        Math.ceil(sequenceRuntime.replayJourney.currentStep),
        totalSteps,
      );
      const percent = Math.round((sequenceRuntime.replayJourney.currentStep / totalSteps) * 100);
      return {
        mode: "running" as const,
        currentStep,
        totalSteps,
        percent,
        label: `Running replay ${currentStep}/${totalSteps}`,
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
  }, [hasReplayJourneyResult, sequenceRuntime.replayBatchSession, sequenceRuntime.replayJourney, shouldPromptReplayRerun]);

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

  return useMemo(
    () => ({
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
    }),
    [
      autoReplayOnMount,
      autoReplayQueued,
      effectiveSelectedSequenceStepId,
      focusedEventStepId,
      gameActiveStepId,
      hasFreshSequenceAccuracy,
      hasReplayJourneyResult,
      isSequencePanelOpen,
      replayHeaderState,
      replayRunningHiddenStepId,
      selectedRuntimeKey,
      selectedSequenceStepId,
      sequenceRuntime,
      shouldPromptReplayRerun,
      shouldShakeManualRun,
      showEventRunControls,
      staleStepIds,
    ],
  );
}
