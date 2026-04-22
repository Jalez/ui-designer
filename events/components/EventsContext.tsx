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

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import type { InteractionTrigger } from "@/types";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import { useLevelContext } from "@/components/ArtBoards/LevelContext";
import { useStepScopedMapState } from "@/events/hooks/useStepScopedMapState";
import {
  getLatestUsableReplayComparisonResultForStep,
  selectBoardFreshnessMap,
  useArtboardReplayRuntimeStore,
} from "@/events/core/artboardReplayRuntimeStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";

function formatStepAccuracyPercent(value: number): string {
  return `${parseFloat(value.toFixed(2))}%`;
}

function areInteractionTriggersEqual(
  previous: InteractionTrigger[] | undefined,
  next: InteractionTrigger[],
): boolean {
  if (previous === next) {
    return true;
  }
  if (!previous || previous.length !== next.length) {
    return false;
  }
  return previous.every((trigger, index) => {
    const candidate = next[index];
    return (
      trigger.id === candidate.id
      && trigger.eventType === candidate.eventType
      && trigger.selector === candidate.selector
      && trigger.keyFilter === candidate.keyFilter
      && trigger.label === candidate.label
    );
  });
}

export type EventStepStatus = {
  rawAccuracy: number | null;
  loading: boolean;
  comparisonFailed: boolean;
  measured: boolean;
  percent: number;
  stale: boolean;
  accuracyText: string | null;
};

export type EventsStateValue = {
  solutionUrlByStepId: Record<string, string>;
  drawboardUrlByStepId: Record<string, string>;
  diffUrlByStepId: Record<string, string>;
  accuracyByStepId: Record<string, number>;
  stepStatusByStepId: Record<string, EventStepStatus>;
  interactionTriggersByStepId: Record<string, InteractionTrigger[]>;
};

export type EventsActionsValue = {
  setCurrentEventSolutionUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventDrawboardUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventDiffUrl: (url: string, stepId?: string | null) => void;
  setCurrentEventAccuracy: (accuracy: number, stepId?: string | null) => void;
  setCurrentInteractionTriggers: (triggers: InteractionTrigger[], stepId?: string | null) => void;
  selectStep: (stepId: string) => void;
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
    selectedScenario,
    selectedScenarioSequence,
    staleStepIds,
    updateScenarioEventAccuracy,
    updateScenarioEventDiffUrl,
    updateScenarioEventSolutionUrl,
  } = useScenarioContext();
  const { currentLevel } = useLevelContext();

  const currentStepId = focusedEventStepId ?? scenarioEventSnapshot.stepId;

  const freshnessByKey = useArtboardReplayRuntimeStore((state) => state.freshnessByKey);
  const drawingFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, scenarioScopeKey, "drawing"),
    [freshnessByKey, scenarioScopeKey],
  );
  const solutionFreshnessByStep = useMemo(
    () => selectBoardFreshnessMap(freshnessByKey, scenarioScopeKey, "solution"),
    [freshnessByKey, scenarioScopeKey],
  );

  const {
    byStepId: solutionUrlByStepId,
    setForStep: setCurrentEventSolutionUrl,
  } = useStepScopedMapState<string>({
    currentStepId,
    resetKey: scenarioScopeKey,
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
    isEqual: areInteractionTriggersEqual,
  });

  const stepStatusByStepId = useMemo<Record<string, EventStepStatus>>(() => {
    const stepIds = selectedScenarioSequence.map((step) => step.id);

    return stepIds.reduce<Record<string, EventStepStatus>>((result, stepId) => {
      const latestReplayResult = getLatestUsableReplayComparisonResultForStep(
        scenarioScopeKey,
        stepId,
        drawingFreshnessByStep[stepId]?.fingerprint,
        solutionFreshnessByStep[stepId]?.fingerprint,
      );
      const stale = Boolean(staleStepIds?.has(stepId));
      const rawAccuracy = stale ? null : (latestReplayResult?.accuracy ?? null);
      const loading = rawAccuracy === -1;
      const comparisonFailed = rawAccuracy === -2;
      const measured = typeof rawAccuracy === "number" && rawAccuracy >= 0;
      const percent = measured ? rawAccuracy : 0;
      const accuracyText = comparisonFailed
        ? "failed"
        : measured
          ? formatStepAccuracyPercent(percent)
          : null;

      result[stepId] = {
        rawAccuracy,
        loading,
        comparisonFailed,
        measured,
        percent,
        stale,
        accuracyText,
        };
      return result;
    }, {});
  }, [drawingFreshnessByStep, scenarioScopeKey, selectedScenarioSequence, solutionFreshnessByStep, staleStepIds]);

  const selectStep = useCallback((stepId: string) => {
    if (!selectedScenario) return;
    useEventSequenceTimelineUiStore
      .getState()
      .setSelectedStep(currentLevel, selectedScenario.scenarioId, stepId);
  }, [currentLevel, selectedScenario]);

  const state = useMemo<EventsStateValue>(
    () => ({
      solutionUrlByStepId,
      drawboardUrlByStepId,
      diffUrlByStepId,
      accuracyByStepId,
      stepStatusByStepId,
      interactionTriggersByStepId,
    }),
    [
      accuracyByStepId,
      diffUrlByStepId,
      drawboardUrlByStepId,
      interactionTriggersByStepId,
      solutionUrlByStepId,
      stepStatusByStepId,
    ],
  );

  const actions = useMemo<EventsActionsValue>(
    () => ({
      setCurrentEventSolutionUrl,
      setCurrentEventDrawboardUrl,
      setCurrentEventDiffUrl,
      setCurrentEventAccuracy,
      setCurrentInteractionTriggers,
      selectStep,
    }),
    [
      setCurrentEventAccuracy,
      setCurrentEventDiffUrl,
      setCurrentEventDrawboardUrl,
      setCurrentEventSolutionUrl,
      setCurrentInteractionTriggers,
      selectStep,
    ],
  );

  const value = useMemo<EventsContextValue>(() => ({ state, actions }), [actions, state]);

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
