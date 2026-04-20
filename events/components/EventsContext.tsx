"use client";

/**
 * EventsContext — plural, step-scoped event store for the selected scenario.
 *
 * Reads scenario-level defaults + persistence actions from ScenarioContext,
 * then owns the in-memory by-step maps used by event UI.
 *
 * Data flow:
 * ScenarioContext (scope + scenario-event API) -> EventsContext (by-step maps)
 * -> EventContext (current event snapshot)
 */

import { createContext, useContext, type ReactNode } from "react";
import type { InteractionTrigger } from "@/types";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { useStepScopedMapState } from "@/events/hooks/useStepScopedMapState";
import {
  getStepAccuracyValueFromCapture,
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "@/events/core/eventSequenceCaptureStore";

export type EventsStateValue = {
  solutionUrlByStepId: Record<string, string>;
  drawboardUrlByStepId: Record<string, string>;
  diffUrlByStepId: Record<string, string>;
  accuracyByStepId: Record<string, number>;
  interactionTriggersByStepId: Record<string, InteractionTrigger[]>;
};

export type EventsActionsValue = {
  setCurrentEventSolutionUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventDrawboardUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventDiffUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventAccuracy: (accuracy: number, stepId?: string | null) => void;
  setCurrentInteractionTriggers: (triggers: InteractionTrigger[], stepId?: string | null) => void;
};

type EventsContextValue = {
  state: EventsStateValue;
  actions: EventsActionsValue;
};

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const {
    scenarioEventSnapshot,
    focusedEventStepId,
    scenarioScopeKey,
    updateScenarioEventAccuracy,
    updateScenarioEventDiffUrl,
    updateScenarioEventSolutionUrl,
  } = useScenarioContext();

  const currentStepId = focusedEventStepId ?? scenarioEventSnapshot.stepId;

  const currentAccuracyRaw = useEventSequenceCaptureStore((store) => {
    const capture = selectCaptureState(store.captureByKey, scenarioScopeKey);
    return getStepAccuracyValueFromCapture(capture, currentStepId);
  });

  const {
    byStepId: solutionUrlByStepId,
    setForStep: setCurrentEventSolutionUrl,
  } = useStepScopedMapState<string>({
    currentStepId,
    resetKey: scenarioScopeKey,
    fallbackValue: scenarioEventSnapshot.solutionUrl,
    shouldSet: (url) => Boolean(url),
    onSet: (url, stepId) => {
      updateScenarioEventSolutionUrl(url, stepId);
    },
  });

  const {
    byStepId: drawboardUrlByStepId,
    setForStep: setCurrentEventDrawboardUrl,
  } = useStepScopedMapState<string>({
    currentStepId,
    resetKey: scenarioScopeKey,
    shouldSet: (url) => Boolean(url),
  });

  const {
    byStepId: diffUrlByStepId,
    setForStep: setCurrentEventDiffUrl,
  } = useStepScopedMapState<string>({
    currentStepId,
    resetKey: scenarioScopeKey,
    fallbackValue: scenarioEventSnapshot.diffUrl,
    shouldSet: (url) => Boolean(url),
    onSet: (url, stepId) => {
      updateScenarioEventDiffUrl(url, stepId);
    },
  });

  const {
    byStepId: accuracyByStepId,
    setForStep: setCurrentEventAccuracy,
  } = useStepScopedMapState<number>({
    currentStepId,
    resetKey: scenarioScopeKey,
    fallbackValue: currentAccuracyRaw,
    onSet: (accuracy, stepId) => {
      updateScenarioEventAccuracy(accuracy, stepId);
    },
  });

  const {
    byStepId: interactionTriggersByStepId,
    setForStep: setCurrentInteractionTriggers,
  } = useStepScopedMapState<InteractionTrigger[]>({
    currentStepId,
    resetKey: scenarioScopeKey,
    normalize: (triggers) => (Array.isArray(triggers) ? triggers : []),
  });

  const value: EventsContextValue = {
    state: {
      solutionUrlByStepId,
      drawboardUrlByStepId,
      diffUrlByStepId,
      accuracyByStepId,
      interactionTriggersByStepId,
    },
    actions: {
      setCurrentEventSolutionUrl,
      setCurrentEventDrawboardUrl,
      setCurrentEventDiffUrl,
      setCurrentEventAccuracy,
      setCurrentInteractionTriggers,
    },
  };

  return (
    <EventsContext.Provider value={value}>
      {children}
    </EventsContext.Provider>
  );
}

function useEventsContext(): EventsContextValue {
  const context = useContext(EventsContext);
  if (!context) {
    throw new Error("useEventsContext must be used within EventsProvider");
  }
  return context;
}

export function useEventsState(): EventsStateValue {
  return useEventsContext().state;
}

export function useEventsActions(): EventsActionsValue {
  return useEventsContext().actions;
}
