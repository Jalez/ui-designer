"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { clearEventSequenceForScenario, removeEventSequenceStep } from "@/store/slices/levels.slice";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { useLevelContext } from "@/components/ArtBoards/LevelContext";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import { useEventSequencePreview } from "@/events/hooks/useEventSequencePreview";
import { useEventSequenceRecordingStore } from "@/events/core/eventSequenceRecordingStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import { resetRuntimeForKey } from "@/events/core/eventSequenceState";
import type {
  EventSequenceRecordingMode,
  SequenceRuntimeState,
} from "@/events/core/eventSequenceReplayTypes";
import type { EventSequenceStep, InteractionTrigger } from "@/types";

export type EventRecorderContextValue = {
  effectiveSelectedSequenceStepId: string | null;
  handleClearSelectedSequence: () => void;
  handleRemoveSelectedStep: () => void;
  handleSetSelectedScenarioInteractive: (checked: boolean) => void;
  handleStartContinuousRecording: () => void;
  handleStartSingleStepRecording: () => void;
  handleStopSequenceRecording: () => void;
  interactionTriggers: InteractionTrigger[];
  isSequencePanelOpen: boolean;
  isSequenceRecording: boolean;
  recordingMode: EventSequenceRecordingMode;
  replaySequence: EventSequenceStep[];
  selectedSequenceRuntime: SequenceRuntimeState;
  selectedSequenceRuntimeKey: string | null;
  selectedSequenceScenarioId: string | null;
  selectedSequenceStep: EventSequenceStep | null;
  selectedSequenceStepId: string | null;
  selectedSequenceStepIsLast: boolean;
  selectedSequenceSteps: EventSequenceStep[];
  showLive: boolean;
};

const EventRecorderContext = createContext<EventRecorderContextValue | null>(null);

export function EventRecorderProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { currentLevel } = useLevelContext();
  const {
    canEditCurrentGame,
    setshowLiveForCurrentRoute,
    showLive,
  } = useGameContext();
  const { syncLevelFields } = useLevelMetaSync();
  const {
    effectiveSelectedSequenceStepId,
    isSequencePanelOpen,
    selectedRuntimeKey,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioSequence,
    selectedSequenceStepId,
    sequenceRuntime,
  } = useScenarioContext();
  const setPanelOpen = useEventSequenceTimelineUiStore((state) => state.setPanelOpen);

  const selectedSequenceScenarioId = selectedScenario?.scenarioId ?? null;
  const selectedSequenceRuntimeKey = selectedRuntimeKey;
  const selectedSequenceSteps = selectedScenarioSequence;
  const recordingMode = sequenceRuntime.recordingMode;

  const {
    interactionTriggers,
    isSequenceRecording,
    replaySequence,
  } = useEventSequencePreview({
    isCreator: canEditCurrentGame,
    scenarioSequence: selectedSequenceSteps,
    selectedEventSequenceStepId: effectiveSelectedSequenceStepId,
    recordingMode,
    showLive,
    hasCapture: Boolean(selectedScenarioDrawingUrl),
  });

  const selectedSequenceStep = selectedSequenceStepId
    ? selectedSequenceSteps.find((step) => step.id === selectedSequenceStepId && step.isInitial !== true) ?? null
    : null;
  const selectedSequenceStepIsLast = Boolean(
    selectedSequenceStep
    && selectedSequenceSteps.length > 0
    && selectedSequenceSteps[selectedSequenceSteps.length - 1]?.id === selectedSequenceStep.id,
  );
  const initialStepId = selectedSequenceSteps[0]?.id ?? null;

  const handleStartSingleStepRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey || !selectedSequenceScenarioId) {
      return;
    }
    setPanelOpen(currentLevel, selectedSequenceScenarioId, true);
    useEventSequenceRecordingStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "single");
  }, [currentLevel, selectedSequenceRuntimeKey, selectedSequenceScenarioId, setPanelOpen]);

  const handleStartContinuousRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey || !selectedSequenceScenarioId) {
      return;
    }
    setPanelOpen(currentLevel, selectedSequenceScenarioId, true);
    useEventSequenceRecordingStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "continuous");
  }, [currentLevel, selectedSequenceRuntimeKey, selectedSequenceScenarioId, setPanelOpen]);

  const handleStopSequenceRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey) {
      return;
    }
    useEventSequenceRecordingStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "idle");
  }, [selectedSequenceRuntimeKey]);

  const handleClearSelectedSequence = useCallback(() => {
    if (!selectedSequenceScenarioId) {
      return;
    }
    dispatch(clearEventSequenceForScenario({ levelId: currentLevel, scenarioId: selectedSequenceScenarioId }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
    if (selectedSequenceRuntimeKey) {
      resetRuntimeForKey(selectedSequenceRuntimeKey);
    }
    useEventSequenceTimelineUiStore.getState().setSelectedStep(
      currentLevel,
      selectedSequenceScenarioId,
      initialStepId ?? "",
    );
  }, [currentLevel, dispatch, initialStepId, selectedSequenceRuntimeKey, selectedSequenceScenarioId, syncLevelFields]);

  const handleRemoveSelectedStep = useCallback(() => {
    if (!selectedSequenceScenarioId || !selectedSequenceStep || !selectedSequenceStepIsLast) {
      return;
    }
    dispatch(removeEventSequenceStep({
      levelId: currentLevel,
      scenarioId: selectedSequenceScenarioId,
      stepId: selectedSequenceStep.id,
    }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
    useEventSequenceTimelineUiStore.getState().setSelectedStep(
      currentLevel,
      selectedSequenceScenarioId,
      initialStepId ?? "",
    );
  }, [currentLevel, dispatch, initialStepId, selectedSequenceScenarioId, selectedSequenceStep, selectedSequenceStepIsLast, syncLevelFields]);

  const handleSetSelectedScenarioInteractive = useCallback((checked: boolean) => {
    if (!selectedSequenceScenarioId) {
      return;
    }
    setshowLiveForCurrentRoute(checked);
    if (checked) {
      setPanelOpen(currentLevel, selectedSequenceScenarioId, true);
    }
    if (!checked && selectedSequenceRuntimeKey) {
      useEventSequenceRecordingStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "idle");
    }
  }, [
    currentLevel,
    selectedSequenceRuntimeKey,
    selectedSequenceScenarioId,
    setPanelOpen,
    setshowLiveForCurrentRoute,
  ]);

  const value = useMemo<EventRecorderContextValue>(() => ({
    effectiveSelectedSequenceStepId: effectiveSelectedSequenceStepId ?? null,
    handleClearSelectedSequence,
    handleRemoveSelectedStep,
    handleSetSelectedScenarioInteractive,
    handleStartContinuousRecording,
    handleStartSingleStepRecording,
    handleStopSequenceRecording,
    interactionTriggers,
    isSequencePanelOpen,
    isSequenceRecording,
    recordingMode,
    replaySequence,
    selectedSequenceRuntime: sequenceRuntime,
    selectedSequenceRuntimeKey,
    selectedSequenceScenarioId,
    selectedSequenceStep,
    selectedSequenceStepId,
    selectedSequenceStepIsLast,
    selectedSequenceSteps,
    showLive,
  }), [
    effectiveSelectedSequenceStepId,
    handleClearSelectedSequence,
    handleRemoveSelectedStep,
    handleSetSelectedScenarioInteractive,
    handleStartContinuousRecording,
    handleStartSingleStepRecording,
    handleStopSequenceRecording,
    interactionTriggers,
    isSequencePanelOpen,
    isSequenceRecording,
    recordingMode,
    replaySequence,
    selectedSequenceRuntimeKey,
    selectedSequenceScenarioId,
    selectedSequenceStep,
    selectedSequenceStepId,
    selectedSequenceStepIsLast,
    selectedSequenceSteps,
    sequenceRuntime,
    showLive,
  ]);

  return (
    <EventRecorderContext.Provider value={value}>
      {children}
    </EventRecorderContext.Provider>
  );
}

export function useEventRecorderContext(): EventRecorderContextValue {
  const context = useContext(EventRecorderContext);
  if (!context) {
    throw new Error("useEventRecorderContext must be used within EventRecorderProvider");
  }
  return context;
}
