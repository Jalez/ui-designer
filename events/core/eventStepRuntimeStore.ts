"use client";

import { create } from "zustand";
import type { InteractionTrigger } from "@/types";

export type EventStepRuntime = {
  accuracyRaw: number | null;
  diffUrl: string | null;
  drawingUrl: string | null;
  interactionTriggers: InteractionTrigger[];
  solutionUrl: string | null;
};

type EventStepRuntimeByStep = Record<string, EventStepRuntime>;

type EventStepRuntimeStore = {
  runtimeByRuntimeKey: Record<string, EventStepRuntimeByStep>;
  clearRuntimeState: (runtimeKey: string) => void;
  mergeStepRuntime: (runtimeKey: string, stepId: string, patch: Partial<EventStepRuntime>) => void;
};

const EMPTY_STEP_RUNTIME_BY_STEP: EventStepRuntimeByStep = {};
const EMPTY_STEP_RUNTIME: EventStepRuntime = {
  accuracyRaw: null,
  diffUrl: null,
  drawingUrl: null,
  interactionTriggers: [],
  solutionUrl: null,
};

function areInteractionTriggersEqual(left: InteractionTrigger[], right: InteractionTrigger[]): boolean {
  if (left === right) {
    return true;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((trigger, index) => {
    const candidate = right[index];
    return (
      trigger.id === candidate.id
      && trigger.eventType === candidate.eventType
      && trigger.selector === candidate.selector
      && trigger.keyFilter === candidate.keyFilter
      && trigger.label === candidate.label
    );
  });
}

function areStepRuntimeEqual(left: EventStepRuntime, right: EventStepRuntime): boolean {
  return (
    left.accuracyRaw === right.accuracyRaw
    && left.diffUrl === right.diffUrl
    && left.drawingUrl === right.drawingUrl
    && left.solutionUrl === right.solutionUrl
    && areInteractionTriggersEqual(left.interactionTriggers, right.interactionTriggers)
  );
}

export const useEventStepRuntimeStore = create<EventStepRuntimeStore>((set) => ({
  runtimeByRuntimeKey: {},

  clearRuntimeState: (runtimeKey) => {
    set((state) => {
      if (!(runtimeKey in state.runtimeByRuntimeKey)) {
        return state;
      }
      const runtimeByRuntimeKey = { ...state.runtimeByRuntimeKey };
      delete runtimeByRuntimeKey[runtimeKey];
      return { runtimeByRuntimeKey };
    });
  },

  mergeStepRuntime: (runtimeKey, stepId, patch) => {
    set((state) => {
      const currentByStep = state.runtimeByRuntimeKey[runtimeKey] ?? EMPTY_STEP_RUNTIME_BY_STEP;
      const current = currentByStep[stepId] ?? EMPTY_STEP_RUNTIME;
      const next: EventStepRuntime = {
        accuracyRaw: "accuracyRaw" in patch ? patch.accuracyRaw ?? null : current.accuracyRaw,
        diffUrl: "diffUrl" in patch ? patch.diffUrl ?? null : current.diffUrl,
        drawingUrl: "drawingUrl" in patch ? patch.drawingUrl ?? null : current.drawingUrl,
        interactionTriggers: "interactionTriggers" in patch ? patch.interactionTriggers ?? [] : current.interactionTriggers,
        solutionUrl: "solutionUrl" in patch ? patch.solutionUrl ?? null : current.solutionUrl,
      };
      if (areStepRuntimeEqual(current, next)) {
        return state;
      }
      return {
        runtimeByRuntimeKey: {
          ...state.runtimeByRuntimeKey,
          [runtimeKey]: {
            ...currentByStep,
            [stepId]: next,
          },
        },
      };
    });
  },
}));

export function selectEventStepRuntimeByStep(
  runtimeByRuntimeKey: Record<string, EventStepRuntimeByStep>,
  runtimeKey: string | null | undefined,
): EventStepRuntimeByStep {
  return runtimeKey ? runtimeByRuntimeKey[runtimeKey] ?? EMPTY_STEP_RUNTIME_BY_STEP : EMPTY_STEP_RUNTIME_BY_STEP;
}

export function getEventStepRuntime(
  runtimeKey: string | null | undefined,
  stepId: string | null | undefined,
): EventStepRuntime | null {
  if (!runtimeKey || !stepId) {
    return null;
  }
  return useEventStepRuntimeStore.getState().runtimeByRuntimeKey[runtimeKey]?.[stepId] ?? null;
}
