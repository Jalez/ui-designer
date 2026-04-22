"use client";

import { useCallback, useMemo } from "react";
import { clearEventSequenceForScenario, removeEventSequenceStep } from "@/store/slices/levels.slice";
import {
  getEventSequenceScenarioUiKey,
  resetRuntimeForKey,
} from "@/events/core/eventSequenceState";
import { useMergedSequenceRuntimeState } from "@/events/core/eventSequenceState";
import { useEventSequenceRecordingStore } from "@/events/core/eventSequenceRecordingStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import type { Level } from "@/types";

type UseSelectedSequenceControlsParams = {
  currentLevel: number;
  dispatch: (action: unknown) => void;
  level: Level | undefined;
  selectedSequenceScenarioIdFromBoard: string | null;
  showLive: boolean;
  setshowLiveForCurrentRoute: (interactive: boolean) => void;
  setPanelOpen: (levelId: number, scenarioId: string, open: boolean) => void;
  syncLevelFields: (levelIndex: number, fields: string[]) => void;
};

export function useSelectedSequenceControls({
  currentLevel,
  dispatch,
  level,
  selectedSequenceScenarioIdFromBoard,
  showLive,
  setshowLiveForCurrentRoute,
  setPanelOpen,
  syncLevelFields,
}: UseSelectedSequenceControlsParams) {
  const selectedSequenceScenarioId =
    selectedSequenceScenarioIdFromBoard ?? level?.scenarios?.[0]?.scenarioId ?? null;

  const selectedSequenceRuntimeKey = useMemo(
    () => (
      selectedSequenceScenarioId
        ? getEventSequenceScenarioUiKey(currentLevel, selectedSequenceScenarioId)
        : null
    ),
    [currentLevel, selectedSequenceScenarioId],
  );

  const selectedSequenceRuntime = useMergedSequenceRuntimeState(selectedSequenceRuntimeKey);

  const selectedSequenceSteps = selectedSequenceScenarioId
    ? level?.eventSequence?.byScenarioId?.[selectedSequenceScenarioId] ?? []
    : [];

  const selectedSequenceStepId = useEventSequenceTimelineUiStore((state) => (
    selectedSequenceScenarioId
      ? state.selectedStepIdByScenario[`${currentLevel}:${selectedSequenceScenarioId}`] ?? null
      : null
  ));

  const initialStepId = selectedSequenceSteps[0]?.id ?? null;
  const selectedSequenceStep = selectedSequenceStepId
    ? selectedSequenceSteps.find((step) => step.id === selectedSequenceStepId && step.isInitial !== true) ?? null
    : null;

  const selectedSequenceStepIsLast = Boolean(
    selectedSequenceStep
    && selectedSequenceSteps.length > 0
    && selectedSequenceSteps[selectedSequenceSteps.length - 1]?.id === selectedSequenceStep.id,
  );

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
    setshowLiveForCurrentRoute,
    setPanelOpen,
  ]);

  return {
    isSequenceRecording: selectedSequenceRuntime.recordingMode !== "idle",
    handleClearSelectedSequence,
    handleRemoveSelectedStep,
    handleSetSelectedScenarioInteractive,
    handleStartContinuousRecording,
    handleStartSingleStepRecording,
    handleStopSequenceRecording,
    selectedSequenceRuntime,
    selectedSequenceRuntimeKey,
    selectedSequenceScenarioId,
    selectedSequenceStep,
    selectedSequenceStepId,
    selectedSequenceStepIsLast,
    selectedSequenceSteps,
    showLive,
  };
}
