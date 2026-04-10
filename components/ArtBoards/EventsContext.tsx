"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { updateEventSequenceStep } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import {
  EMPTY_SEQUENCE_RUNTIME_STATE,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  cancelAutoReplay,
  getEventSequenceRuntimeKey,
  getEventSequenceScenarioUiKey,
  getSequenceRuntimeState,
  hasAutoReplayMountedRun,
  isStepStale,
  markAutoReplayMountedRun,
  requestAutoReplay,
  setAutoReplayOnMount,
  setCreatorPreviewInteractiveForScenario,
  setSelectedEventSequenceStepId,
  subscribeSequenceRuntime,
  useEventSequenceUiState,
  type SequenceRuntimeState,
} from "@/lib/drawboard/eventSequenceState";
import { getDrawboardPixelsSideSerials, subscribeDrawboardPixelsForScenario } from "@/lib/drawboard/drawboardPixelsStore";
import { useAutoReplaySequence } from "@/lib/drawboard/useAutoReplaySequence";
import { useScenarioContext } from "./ScenarioContext";

type EventsContextValue = {
  autoReplayOnMount: boolean;
  creatorPreviewInteractive: boolean;
  effectiveSelectedSequenceStepId: string | null;
  forceInitialStepForAutoReplayStart: boolean;
  gameActiveStepId: string | null;
  handleRunEventsClick: () => void;
  handleSelectStep: (stepId: string) => void;
  handleToggleAutoRunOnMount: () => void;
  handleUpdateStep: (stepId: string, field: "label" | "instruction", value: string) => void;
  isSequencePanelOpen: boolean;
  pendingManualAutoReplay: boolean;
  selectedRuntimeKey: string | null;
  selectedSequenceStepId: string | null;
  sequenceRuntime: SequenceRuntimeState;
  showEventRunControls: boolean;
  staleStepIds: Set<string>;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const {
    currentLevel,
    drawboardCaptureMode,
    isCreatorContext,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioSequence,
  } = useScenarioContext();
  const [pendingManualAutoReplay, setPendingManualAutoReplay] = useState(false);
  const [pendingAutoReplayStart, setPendingAutoReplayStart] = useState(false);

  const selectedScenarioId = selectedScenario?.scenarioId ?? null;
  const scenarioUiKey = selectedScenarioId
    ? getEventSequenceScenarioUiKey(currentLevel, selectedScenarioId)
    : null;
  const selectedRuntimeKey = selectedScenarioId
    ? getEventSequenceRuntimeKey(currentLevel, selectedScenarioId, isCreatorContext)
    : null;

  const selectedScenarioPreviewChoice = useEventSequenceUiState(
    useCallback((state) => {
      if (!scenarioUiKey) {
        return undefined;
      }
      return state.creatorPreviewInteractiveByScenario[scenarioUiKey];
    }, [scenarioUiKey]),
  );
  const isSequencePanelOpen = useEventSequenceUiState(
    useCallback((state) => {
      if (!scenarioUiKey) {
        return false;
      }
      return state.panelOpenByScenario[scenarioUiKey] ?? false;
    }, [scenarioUiKey]),
  );
  const selectedSequenceStepId = useEventSequenceUiState(
    useCallback((state) => {
      if (!scenarioUiKey) {
        return null;
      }
      return state.selectedStepIdByScenario[scenarioUiKey] ?? null;
    }, [scenarioUiKey]),
  );
  const autoReplayOnMount = useEventSequenceUiState(
    useCallback((state) => {
      if (!scenarioUiKey) {
        return false;
      }
      return state.autoReplayOnMountByScenario[scenarioUiKey] ?? false;
    }, [scenarioUiKey]),
  );

  const creatorPreviewInteractive = selectedScenario
    ? (selectedScenarioPreviewChoice ?? !selectedScenarioDrawingUrl)
    : false;

  const sequenceRuntime = useSyncExternalStore(
    useCallback(
      (listener) => (selectedRuntimeKey ? subscribeSequenceRuntime(selectedRuntimeKey, listener) : () => {}),
      [selectedRuntimeKey],
    ),
    useCallback(
      () => (selectedRuntimeKey ? getSequenceRuntimeState(selectedRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedRuntimeKey],
    ),
    useCallback(
      () => (selectedRuntimeKey ? getSequenceRuntimeState(selectedRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedRuntimeKey],
    ),
  );

  const normalizedActiveStepIndex = sequenceRuntime.activeIndex >= selectedScenarioSequence.length
    ? 0
    : sequenceRuntime.activeIndex;
  const forceInitialStepForAutoReplayStart =
    pendingAutoReplayStart
    || (
      sequenceRuntime.autoReplay?.running === true
      && (!selectedSequenceStepId || selectedSequenceStepId === INITIAL_EVENT_SEQUENCE_STEP_ID)
    );
  const effectiveSelectedSequenceStepId = forceInitialStepForAutoReplayStart
    ? INITIAL_EVENT_SEQUENCE_STEP_ID
    : isCreatorContext && isSequencePanelOpen
      ? (selectedSequenceStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID)
      : selectedSequenceStepId;
  const gameActiveStepId = !isCreatorContext && selectedScenarioSequence.length > 0
    ? selectedScenarioSequence[normalizedActiveStepIndex]?.id ?? null
    : null;

  const selectedScenarioDrawingPixelsSerial = useSyncExternalStore(
    useCallback(
      (listener) => (
        selectedScenarioId
          ? subscribeDrawboardPixelsForScenario(selectedScenarioId, listener)
          : () => {}
      ),
      [selectedScenarioId],
    ),
    useCallback(
      () => (selectedScenarioId ? getDrawboardPixelsSideSerials(selectedScenarioId).drawing : 0),
      [selectedScenarioId],
    ),
    useCallback(
      () => (selectedScenarioId ? getDrawboardPixelsSideSerials(selectedScenarioId).drawing : 0),
      [selectedScenarioId],
    ),
  );

  const autoReplayMountReady =
    drawboardCaptureMode !== "browser"
    || isCreatorContext
    || !selectedScenarioId
    || selectedScenarioDrawingPixelsSerial > 0;

  useEffect(() => {
    if (!selectedScenarioId || !isCreatorContext) {
      return;
    }
    setCreatorPreviewInteractiveForScenario(currentLevel, selectedScenarioId, creatorPreviewInteractive);
  }, [creatorPreviewInteractive, currentLevel, isCreatorContext, selectedScenarioId]);

  useEffect(() => {
    if (
      selectedScenarioId
      && autoReplayOnMount
      && selectedRuntimeKey
      && selectedScenarioSequence.length > 0
      && !hasAutoReplayMountedRun(currentLevel, selectedScenarioId)
      && !sequenceRuntime.autoReplay?.running
      && autoReplayMountReady
    ) {
      markAutoReplayMountedRun(currentLevel, selectedScenarioId);
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) {
          setPendingAutoReplayStart(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [
    autoReplayMountReady,
    autoReplayOnMount,
    currentLevel,
    selectedRuntimeKey,
    selectedScenarioId,
    selectedScenarioSequence.length,
    sequenceRuntime.autoReplay?.running,
  ]);

  useEffect(() => {
    if (
      pendingManualAutoReplay
      && selectedScenarioId
      && selectedRuntimeKey
      && selectedScenarioSequence.length > 0
      && !sequenceRuntime.autoReplay?.running
      && autoReplayMountReady
    ) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        setPendingManualAutoReplay(false);
        setPendingAutoReplayStart(true);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [
    autoReplayMountReady,
    pendingManualAutoReplay,
    selectedRuntimeKey,
    selectedScenarioId,
    selectedScenarioSequence.length,
    sequenceRuntime.autoReplay?.running,
  ]);

  useEffect(() => {
    if (!selectedRuntimeKey || !selectedScenarioId || selectedScenarioSequence.length === 0) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        setPendingManualAutoReplay(false);
        setPendingAutoReplayStart(false);
      });
      return () => {
        cancelled = true;
      };
    }
  }, [selectedRuntimeKey, selectedScenarioId, selectedScenarioSequence.length]);

  useEffect(() => {
    if (
      !pendingAutoReplayStart
      || !selectedRuntimeKey
      || !selectedScenarioId
      || selectedScenarioSequence.length === 0
      || sequenceRuntime.autoReplay?.running
      || !autoReplayMountReady
    ) {
      return;
    }
    if (selectedSequenceStepId !== INITIAL_EVENT_SEQUENCE_STEP_ID) {
      setSelectedEventSequenceStepId(currentLevel, selectedScenarioId, INITIAL_EVENT_SEQUENCE_STEP_ID);
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setPendingAutoReplayStart(false);
      requestAutoReplay(selectedRuntimeKey, selectedScenarioSequence.length + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [
    autoReplayMountReady,
    currentLevel,
    pendingAutoReplayStart,
    selectedRuntimeKey,
    selectedScenarioId,
    selectedScenarioSequence.length,
    selectedSequenceStepId,
    sequenceRuntime.autoReplay?.running,
  ]);

  useAutoReplaySequence({
    runtimeKey: selectedRuntimeKey,
    levelId: currentLevel,
    scenarioId: selectedScenarioId,
    steps: selectedScenarioSequence,
    autoReplay: sequenceRuntime.autoReplay,
  });

  const staleStepIds = useMemo(() => {
    const set = new Set<string>();
    for (const stepId of Object.keys(sequenceRuntime.stepAccuracyVersions)) {
      if (isStepStale(sequenceRuntime, stepId)) {
        set.add(stepId);
      }
    }
    return set;
  }, [sequenceRuntime]);

  const showEventRunControls =
    Boolean(selectedScenarioId)
    && selectedScenarioSequence.length > 0
    && sequenceRuntime.recordingMode === "idle"
    && Boolean(selectedRuntimeKey);

  const handleRunEventsClick = useCallback(() => {
    if (!selectedRuntimeKey) {
      return;
    }
    const running = getSequenceRuntimeState(selectedRuntimeKey).autoReplay?.running;
    if (running) {
      setPendingManualAutoReplay(false);
      setPendingAutoReplayStart(false);
      cancelAutoReplay(selectedRuntimeKey);
      return;
    }
    if (!autoReplayMountReady) {
      setPendingManualAutoReplay(true);
      return;
    }
    setPendingManualAutoReplay(false);
    setPendingAutoReplayStart(true);
  }, [autoReplayMountReady, selectedRuntimeKey]);

  const handleToggleAutoRunOnMount = useCallback(() => {
    if (!selectedScenarioId) {
      return;
    }
    setAutoReplayOnMount(currentLevel, selectedScenarioId, !autoReplayOnMount);
  }, [autoReplayOnMount, currentLevel, selectedScenarioId]);

  const handleUpdateStep = useCallback((stepId: string, field: "label" | "instruction", value: string) => {
    if (!selectedScenarioId) {
      return;
    }
    dispatch(updateEventSequenceStep({
      levelId: currentLevel,
      scenarioId: selectedScenarioId,
      stepId,
      changes: { [field]: value },
    }));
    syncLevelFields(currentLevel - 1, ["eventSequence"]);
  }, [currentLevel, dispatch, selectedScenarioId, syncLevelFields]);

  const handleSelectStep = useCallback((stepId: string) => {
    if (!selectedScenarioId) {
      return;
    }
    setSelectedEventSequenceStepId(currentLevel, selectedScenarioId, stepId);
  }, [currentLevel, selectedScenarioId]);

  const value = useMemo<EventsContextValue>(() => ({
    autoReplayOnMount,
    creatorPreviewInteractive,
    effectiveSelectedSequenceStepId: effectiveSelectedSequenceStepId ?? null,
    forceInitialStepForAutoReplayStart,
    gameActiveStepId,
    handleRunEventsClick,
    handleSelectStep,
    handleToggleAutoRunOnMount,
    handleUpdateStep,
    isSequencePanelOpen,
    pendingManualAutoReplay,
    selectedRuntimeKey,
    selectedSequenceStepId,
    sequenceRuntime,
    showEventRunControls,
    staleStepIds,
  }), [
    autoReplayOnMount,
    creatorPreviewInteractive,
    effectiveSelectedSequenceStepId,
    forceInitialStepForAutoReplayStart,
    gameActiveStepId,
    handleRunEventsClick,
    handleSelectStep,
    handleToggleAutoRunOnMount,
    handleUpdateStep,
    isSequencePanelOpen,
    pendingManualAutoReplay,
    selectedRuntimeKey,
    selectedSequenceStepId,
    sequenceRuntime,
    showEventRunControls,
    staleStepIds,
  ]);

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  );
}

export function useEventsContext() {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error("useEventsContext must be used within EventsProvider");
  }
  return context;
}
