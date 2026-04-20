"use client";

/**
 * EventContext — real React context for event-sequence state and current-event snapshot.
 *
 * Mount order: LevelProvider > ScenarioProvider > EventProvider > UI.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { EventSequenceStep, InteractionTrigger } from "@/types";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { useStepScopedMapState } from "@/events/hooks/useStepScopedMapState";
import {
  getStepAccuracyValueFromCapture,
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "../core/eventSequenceCaptureStore";

export type EventAccuracyStatus = "ready" | "pending" | "failed" | "missing";

export type CurrentEventSnapshot = {
  stepId: string;
  accuracy: number | null;
  accuracyStatus: EventAccuracyStatus;
  solutionUrlStale: boolean;
  drawboardUrlStale: boolean;
  modelUrl: string | null;
  drawboardUrl: string | null;
  event: EventSequenceStep | null;
  diff: string | null;
};

export type EventStateValue = {
  // Single source of truth for current event state.
  currentEventSnapshot: CurrentEventSnapshot;
  currentInteractionTriggers: InteractionTrigger[];
  solutionUrlByStepId: Record<string, string>;
  drawboardUrlByStepId: Record<string, string>;
  diffUrlByStepId: Record<string, string>;
  accuracyByStepId: Record<string, number>;
  interactionTriggersByStepId: Record<string, InteractionTrigger[]>;
};

export type EventActionsValue = {
  setCurrentEventSolutionUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventDrawboardUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventDiffUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventAccuracy: (accuracy: number, stepId?: string | null) => void;
  setCurrentInteractionTriggers: (triggers: InteractionTrigger[], stepId?: string | null) => void;
};

type EventContextValue = {
  state: EventStateValue;
  actions: EventActionsValue;
};

const EventContext = createContext<EventContextValue | null>(null);

function resolveAccuracy(raw: number | null): { value: number | null; status: EventAccuracyStatus } {
  if (raw === -1) {
    return { value: null, status: "pending" };
  }
  if (raw === -2) {
    return { value: null, status: "failed" };
  }
  if (typeof raw === "number" && raw >= 0) {
    return { value: raw, status: "ready" };
  }
  return { value: null, status: "missing" };
}

export function EventProvider({ children }: { children: ReactNode }) {
  const {
    eventBridge,
    focusedEventStepId,
    selectedRuntimeKey,
    selectedScenarioSequence,
    shouldPromptReplayRerun,
  } = useScenarioContext();

  const currentStepId = focusedEventStepId ?? eventBridge.current.stepId;
  const currentEvent = useMemo(
    () => selectedScenarioSequence.find((step) => step.id === currentStepId) ?? null,
    [currentStepId, selectedScenarioSequence],
  );

  const currentAccuracyRaw = useEventSequenceCaptureStore((store) => {
    const capture = selectCaptureState(store.captureByKey, selectedRuntimeKey);
    return getStepAccuracyValueFromCapture(capture, currentStepId);
  });
  const {
    byStepId: solutionUrlByStepId,
    setForStep: setCurrentEventSolutionUrl,
  } = useStepScopedMapState<string>({
    currentStepId,
    resetKey: selectedRuntimeKey,
    fallbackValue: eventBridge.current.solutionUrl,
    shouldSet: (url) => Boolean(url),
    onSet: (url, stepId) => {
      eventBridge.handlers.setCurrentEventSolutionUrl(url, stepId);
    },
  });
  const {
    byStepId: drawboardUrlByStepId,
    setForStep: setCurrentEventDrawboardUrl,
  } = useStepScopedMapState<string>({
    currentStepId,
    resetKey: selectedRuntimeKey,
    shouldSet: (url) => Boolean(url),
  });
  const {
    byStepId: diffUrlByStepId,
    setForStep: setCurrentEventDiffUrl,
  } = useStepScopedMapState<string>({
    currentStepId,
    resetKey: selectedRuntimeKey,
    fallbackValue: eventBridge.current.diffUrl,
    shouldSet: (url) => Boolean(url),
    onSet: (url, stepId) => {
      eventBridge.handlers.setCurrentEventDiffUrl(url, stepId);
    },
  });
  const {
    byStepId: accuracyByStepId,
    setForStep: setCurrentEventAccuracy,
  } = useStepScopedMapState<number>({
    currentStepId,
    resetKey: selectedRuntimeKey,
    fallbackValue: currentAccuracyRaw,
    onSet: (accuracy, stepId) => {
      eventBridge.handlers.setCurrentEventAccuracy(accuracy, stepId);
    },
  });
  const {
    byStepId: interactionTriggersByStepId,
    setForStep: setCurrentInteractionTriggers,
  } = useStepScopedMapState<InteractionTrigger[]>({
    currentStepId,
    resetKey: selectedRuntimeKey,
    normalize: (triggers) => (Array.isArray(triggers) ? triggers : []),
  });

  const currentInteractionTriggers = useMemo(
    () => interactionTriggersByStepId[currentStepId] ?? [],
    [currentStepId, interactionTriggersByStepId],
  );

  const currentModelUrl = solutionUrlByStepId[currentStepId] ?? eventBridge.current.solutionUrl;
  const currentDiff = diffUrlByStepId[currentStepId] ?? eventBridge.current.diffUrl;
  const currentEventDrawboardUrl = drawboardUrlByStepId[currentStepId] ?? null;
  const accuracySourceValue = accuracyByStepId[currentStepId] ?? currentAccuracyRaw;
  const { value: currentAccuracy, status: accuracyStatus } = useMemo(
    () => resolveAccuracy(accuracySourceValue),
    [accuracySourceValue],
  );
  const currentDrawboardUrlStale = !currentEventDrawboardUrl || shouldPromptReplayRerun;

  const currentEventSnapshot = useMemo<CurrentEventSnapshot>(() => ({
    stepId: currentStepId,
    accuracy: currentAccuracy,
    accuracyStatus,
    solutionUrlStale: eventBridge.current.solutionUrlStale,
    drawboardUrlStale: currentDrawboardUrlStale,
    modelUrl: currentModelUrl,
    drawboardUrl: currentEventDrawboardUrl,
    event: currentEvent,
    diff: currentDiff,
  }), [
    accuracyStatus,
    currentAccuracy,
    currentDrawboardUrlStale,
    currentEventDrawboardUrl,
    eventBridge.current.solutionUrlStale,
    currentDiff,
    currentEvent,
    currentModelUrl,
    currentStepId,
  ]);

  const state = useMemo<EventStateValue>(() => ({
      interactionTriggersByStepId,
      currentInteractionTriggers,
      currentEventSnapshot,
      drawboardUrlByStepId,
      solutionUrlByStepId,
      accuracyByStepId,
      diffUrlByStepId,
  }), [
      interactionTriggersByStepId,
      currentInteractionTriggers,
      currentEventSnapshot,
      drawboardUrlByStepId,
      solutionUrlByStepId,
      accuracyByStepId,
      diffUrlByStepId,
  ]);

  const actions = useMemo<EventActionsValue>(() => ({
    setCurrentEventSolutionUrl,
    setCurrentEventDrawboardUrl,
    setCurrentEventDiffUrl,
    setCurrentEventAccuracy,
    setCurrentInteractionTriggers,
  }), [
    setCurrentEventSolutionUrl,
    setCurrentEventDrawboardUrl,
    setCurrentEventDiffUrl,
    setCurrentEventAccuracy,
    setCurrentInteractionTriggers,
  ]);

  const value = useMemo<EventContextValue>(() => ({ state, actions }), [actions, state]);

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

function useEventContext(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEventContext must be used within EventProvider");
  }
  return context;
}

export function useEventState(): EventStateValue {
  return useEventContext().state;
}

export function useEventActions(): EventActionsValue {
  return useEventContext().actions;
}
