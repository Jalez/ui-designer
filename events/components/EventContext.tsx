"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { EventSequenceStep } from "@/types";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import {
  EventsProvider,
  useEventsActions,
  useEventsState,
  type EventsActionsValue,
} from "@/events/components/EventsContext";

export type EventAccuracyStatus = "ready" | "pending" | "failed" | "missing";

export type CurrentEventSnapshot = {
  stepId: string | null;
  accuracy: number | null;
  accuracyStatus: EventAccuracyStatus;
  solutionUrlStale: boolean;
  drawboardUrlStale: boolean;
  modelUrl: string | null;
  event: EventSequenceStep | null;
  diff: string | null;
};

export type EventStateValue = {
  currentEventSnapshot: CurrentEventSnapshot;
};

export type EventActionsValue = EventsActionsValue;

type EventContextValue = {
  state: EventStateValue;
  actions: EventActionsValue;
};

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({ children }: { children: ReactNode }) {
  return (
    <EventsProvider>
      <CurrentEventProvider>{children}</CurrentEventProvider>
    </EventsProvider>
  );
}

function CurrentEventProvider({ children }: { children: ReactNode }) {
  const { selectedScenarioSequence } = useScenarioContext();
  const { selectedStepId, stepsById } = useEventsState();
  const actions = useEventsActions();

  const currentEvent = useMemo(
    () => selectedScenarioSequence.find((step) => step.id === selectedStepId) ?? null,
    [selectedStepId, selectedScenarioSequence],
  );

  const currentStep = selectedStepId ? stepsById[selectedStepId] : undefined;

  const currentEventSnapshot = useMemo<CurrentEventSnapshot>(() => ({
    stepId: selectedStepId,
    accuracy: currentStep?.accuracyStatus === "ready" ? currentStep.accuracyRaw : null,
    accuracyStatus: currentStep?.accuracyStatus ?? "missing",
    solutionUrlStale: currentStep?.solutionStale ?? true,
    drawboardUrlStale: currentStep?.drawingStale ?? true,
    modelUrl: currentStep?.solutionUrl ?? null,
    event: currentEvent,
    diff: currentStep?.diffUrl ?? null,
  }), [currentEvent, currentStep, selectedStepId]);

  const state = useMemo<EventStateValue>(() => ({
    currentEventSnapshot,
  }), [currentEventSnapshot]);

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
