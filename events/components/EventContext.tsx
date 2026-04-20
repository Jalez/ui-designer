"use client";

/**
 * EventContext — real React context for event-sequence state and current-event snapshot.
 *
 * Singular facade over the currently focused event.
 *
 * Mount order: GameProvider > LevelProvider > ScenarioProvider > EventProvider > UI.
 * Data flow: ScenarioContext + EventsContext -> EventContext.currentEventSnapshot
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { EventSequenceStep, InteractionTrigger } from "@/types";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import {
  EventsProvider,
  useEventsActions,
  useEventsState,
  type EventsActionsValue,
  type EventsStateValue,
} from "@/events/components/EventsContext";
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
  // Single source of truth for currently focused event state.
  currentEventSnapshot: CurrentEventSnapshot;
  currentInteractionTriggers: InteractionTrigger[];
};

export type EventActionsValue = EventsActionsValue;

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
  return (
    <EventsProvider>
      <CurrentEventProvider>{children}</CurrentEventProvider>
    </EventsProvider>
  );
}

function CurrentEventProvider({ children }: { children: ReactNode }) {
  const {
    scenarioEventSnapshot,
    focusedEventStepId,
    scenarioScopeKey,
    selectedScenarioSequence,
    shouldPromptReplayRerun,
  } = useScenarioContext();
  const {
    solutionUrlByStepId,
    drawboardUrlByStepId,
    diffUrlByStepId,
    accuracyByStepId,
    interactionTriggersByStepId,
  } = useEventsState();
  const actions = useEventsActions();

  const currentStepId = focusedEventStepId ?? scenarioEventSnapshot.stepId;
  const currentEvent = useMemo(
    () => selectedScenarioSequence.find((step) => step.id === currentStepId) ?? null,
    [currentStepId, selectedScenarioSequence],
  );

  const currentAccuracyRaw = useEventSequenceCaptureStore((store) => {
    const capture = selectCaptureState(store.captureByKey, scenarioScopeKey);
    return getStepAccuracyValueFromCapture(capture, currentStepId);
  });

  const currentInteractionTriggers = useMemo(
    () => interactionTriggersByStepId[currentStepId] ?? [],
    [currentStepId, interactionTriggersByStepId],
  );

  const currentModelUrl = solutionUrlByStepId[currentStepId] ?? scenarioEventSnapshot.solutionUrl;
  const currentDiff = diffUrlByStepId[currentStepId] ?? scenarioEventSnapshot.diffUrl;
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
    solutionUrlStale: scenarioEventSnapshot.solutionUrlStale,
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
    scenarioEventSnapshot.solutionUrlStale,
    currentDiff,
    currentEvent,
    currentModelUrl,
    currentStepId,
  ]);

  const state = useMemo<EventStateValue>(() => ({
    currentInteractionTriggers,
    currentEventSnapshot,
  }), [
    currentInteractionTriggers,
    currentEventSnapshot,
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
