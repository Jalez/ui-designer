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
import type { EventSequenceStep } from "@/types";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import {
  EventsProvider,
  useEventsActions,
  useEventsState,
  type EventsActionsValue,
} from "@/events/components/EventsContext";
import {
  getLatestUsableReplayComparisonResultForStep,
  selectBoardFreshnessMap,
  useArtboardReplayRuntimeStore,
} from "../core/artboardReplayRuntimeStore";

export type EventAccuracyStatus = "ready" | "pending" | "failed" | "missing";

export type CurrentEventSnapshot = {
  stepId: string;
  accuracy: number | null;
  accuracyStatus: EventAccuracyStatus;
  solutionUrlStale: boolean;
  drawboardUrlStale: boolean;
  modelUrl: string | null;
  event: EventSequenceStep | null;
  diff: string | null;
};

export type EventStateValue = {
  // Single source of truth for currently focused event state.
  currentEventSnapshot: CurrentEventSnapshot;
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
    focusedEventStepId,
    scenarioEventSnapshot,
    scenarioScopeKey,
    selectedScenarioSequence,
    shouldPromptReplayRerun,
  } = useScenarioContext();
  const {
    solutionUrlByStepId,
  } = useEventsState();
  const actions = useEventsActions();
  const freshnessByKey = useArtboardReplayRuntimeStore((state) => state.freshnessByKey);
  const drawingFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, scenarioScopeKey, "drawing"),
    [freshnessByKey, scenarioScopeKey],
  );
  const solutionFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, scenarioScopeKey, "solution"),
    [freshnessByKey, scenarioScopeKey],
  );

  const currentStepId = focusedEventStepId ?? scenarioEventSnapshot.stepId;
  const currentEvent = useMemo(
    () => selectedScenarioSequence.find((step) => step.id === currentStepId) ?? null,
    [currentStepId, selectedScenarioSequence],
  );

  const latestReplayResult = useMemo(
    () => getLatestUsableReplayComparisonResultForStep(
      scenarioScopeKey,
      currentStepId,
      drawingFreshnessByStep[currentStepId]?.fingerprint,
      solutionFreshnessByStep[currentStepId]?.fingerprint,
    ),
    [currentStepId, drawingFreshnessByStep, scenarioScopeKey, solutionFreshnessByStep],
  );

  const currentModelUrl = solutionFreshnessByStep[currentStepId]?.imageUrl
    ?? solutionUrlByStepId[currentStepId]
    ?? null;
  const currentDiff = latestReplayResult?.diff ?? null;
  const currentDrawboardFreshness = drawingFreshnessByStep[currentStepId];
  const accuracySourceValue = shouldPromptReplayRerun ? null : (latestReplayResult?.accuracy ?? null);
  const { value: currentAccuracy, status: accuracyStatus } = useMemo(
    () => resolveAccuracy(accuracySourceValue),
    [accuracySourceValue],
  );
  const currentDrawboardUrlStale = shouldPromptReplayRerun
    || !currentDrawboardFreshness?.imageUrl
    || Boolean(currentDrawboardFreshness?.isStale);
  const currentSolutionFreshness = solutionFreshnessByStep[currentStepId];
  const currentSolutionUrlStale = !currentSolutionFreshness?.imageUrl
    || Boolean(currentSolutionFreshness?.isStale);

  const currentEventSnapshot = useMemo<CurrentEventSnapshot>(() => ({
    stepId: currentStepId,
    accuracy: currentAccuracy,
    accuracyStatus,
    solutionUrlStale: currentSolutionUrlStale,
    drawboardUrlStale: currentDrawboardUrlStale,
    modelUrl: currentModelUrl,
    event: currentEvent,
    diff: currentDiff,
  }), [
    accuracyStatus,
    currentAccuracy,
    currentDrawboardUrlStale,
    currentDiff,
    currentEvent,
    currentModelUrl,
    currentSolutionUrlStale,
    currentStepId,
  ]);

  const state = useMemo<EventStateValue>(() => ({
    currentEventSnapshot,
  }), [
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
