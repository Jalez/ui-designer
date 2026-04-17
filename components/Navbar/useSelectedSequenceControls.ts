"use client";

import { useCallback, useMemo } from "react";
import { clearEventSequenceForScenario, removeEventSequenceStep } from "@/store/slices/levels.slice";
import {
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  getEventSequenceRuntimeKey,
  selectRuntimeState,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import type { Level } from "@/types";

type UseSelectedSequenceControlsParams = {
  currentLevel: number;
  dispatch: (action: unknown) => void;
  isCreatorRoute: boolean;
  level: Level | undefined;
  selectedSequenceScenarioIdFromBoard: string | null;
  selectedSequenceScenarioInteractive: boolean;
  setCreatorPreviewInteractiveForScenario: (scenarioId: string, interactive: boolean) => void;
  setPanelOpen: (levelId: number, scenarioId: string, open: boolean) => void;
  syncLevelFields: (levelIndex: number, fields: string[]) => void;
};

export function useSelectedSequenceControls({
  currentLevel,
  dispatch,
  isCreatorRoute,
  level,
  selectedSequenceScenarioIdFromBoard,
  selectedSequenceScenarioInteractive,
  setCreatorPreviewInteractiveForScenario,
  setPanelOpen,
  syncLevelFields,
}: UseSelectedSequenceControlsParams) {
  const selectedSequenceScenarioId =
    selectedSequenceScenarioIdFromBoard ?? level?.scenarios?.[0]?.scenarioId ?? null;

  const selectedSequenceRuntimeKey = useMemo(
    () => (
      selectedSequenceScenarioId
        ? getEventSequenceRuntimeKey(currentLevel, selectedSequenceScenarioId, isCreatorRoute)
        : null
    ),
    [currentLevel, isCreatorRoute, selectedSequenceScenarioId],
  );

  const selectedSequenceRuntime = useEventSequenceStore((state) => (
    selectRuntimeState(state.runtimeByKey, selectedSequenceRuntimeKey)
  ));

  const selectedSequenceSteps = selectedSequenceScenarioId
    ? level?.eventSequence?.byScenarioId?.[selectedSequenceScenarioId] ?? []
    : [];

  const selectedSequenceStepId = useEventSequenceStore((state) => (
    selectedSequenceScenarioId
      ? state.selectedStepIdByScenario[`${currentLevel}:${selectedSequenceScenarioId}`] ?? null
      : null
  ));

  const selectedSequenceStep = selectedSequenceStepId && selectedSequenceStepId !== INITIAL_EVENT_SEQUENCE_STEP_ID
    ? selectedSequenceSteps.find((step) => step.id === selectedSequenceStepId) ?? null
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
    useEventSequenceStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "single");
  }, [currentLevel, selectedSequenceRuntimeKey, selectedSequenceScenarioId, setPanelOpen]);

  const handleStartContinuousRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey || !selectedSequenceScenarioId) {
      return;
    }
    setPanelOpen(currentLevel, selectedSequenceScenarioId, true);
    useEventSequenceStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "continuous");
  }, [currentLevel, selectedSequenceRuntimeKey, selectedSequenceScenarioId, setPanelOpen]);

  const handleStopSequenceRecording = useCallback(() => {
    if (!selectedSequenceRuntimeKey) {
      return;
    }
    useEventSequenceStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "idle");
  }, [selectedSequenceRuntimeKey]);

  const handleClearSelectedSequence = useCallback(() => {
    if (!selectedSequenceScenarioId) {
      return;
    }
    dispatch(clearEventSequenceForScenario({ levelId: currentLevel, scenarioId: selectedSequenceScenarioId }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
    if (selectedSequenceRuntimeKey) {
      useEventSequenceStore.getState().resetRuntimeForKey(selectedSequenceRuntimeKey);
    }
    useEventSequenceStore.getState().setSelectedStep(currentLevel, selectedSequenceScenarioId, INITIAL_EVENT_SEQUENCE_STEP_ID);
  }, [currentLevel, dispatch, selectedSequenceRuntimeKey, selectedSequenceScenarioId, syncLevelFields]);

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
    useEventSequenceStore.getState().setSelectedStep(currentLevel, selectedSequenceScenarioId, INITIAL_EVENT_SEQUENCE_STEP_ID);
  }, [currentLevel, dispatch, selectedSequenceScenarioId, selectedSequenceStep, selectedSequenceStepIsLast, syncLevelFields]);

  const handleSetSelectedScenarioInteractive = useCallback((checked: boolean) => {
    if (!selectedSequenceScenarioId) {
      return;
    }
    setCreatorPreviewInteractiveForScenario(selectedSequenceScenarioId, checked);
    if (checked) {
      setPanelOpen(currentLevel, selectedSequenceScenarioId, true);
    }
    if (!checked && selectedSequenceRuntimeKey) {
      useEventSequenceStore.getState().setRecordingMode(selectedSequenceRuntimeKey, "idle");
    }
  }, [
    currentLevel,
    selectedSequenceRuntimeKey,
    selectedSequenceScenarioId,
    setCreatorPreviewInteractiveForScenario,
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
    selectedSequenceScenarioInteractive,
  };
}
