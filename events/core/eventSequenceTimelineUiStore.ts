"use client";

import { create } from "zustand";

import { getEventSequenceScenarioUiKey } from "./eventSequenceReplayTypes";

type EventSequenceTimelineUiStore = {
  selectedStepIdByScenario: Record<string, string | null>;
  selectedStepRefreshNonceByScenario: Record<string, number>;
  panelOpenByScenario: Record<string, boolean>;
  getSelectedStepIdForScenario: (levelId: number, scenarioId: string) => string | null;
  getSelectedStepRefreshNonceForScenario: (levelId: number, scenarioId: string) => number;
  setSelectedStep: (levelId: number, scenarioId: string, stepId: string | null) => void;
  bumpSelectedStepRefreshNonce: (levelId: number, scenarioId: string) => void;
  setPanelOpen: (levelId: number, scenarioId: string, open: boolean) => void;
};

export const useEventSequenceTimelineUiStore = create<EventSequenceTimelineUiStore>((set, get) => ({
  selectedStepIdByScenario: {},
  selectedStepRefreshNonceByScenario: {},
  panelOpenByScenario: {},

  getSelectedStepIdForScenario: (levelId, scenarioId) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    return get().selectedStepIdByScenario[key] ?? null;
  },

  getSelectedStepRefreshNonceForScenario: (levelId, scenarioId) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    return get().selectedStepRefreshNonceByScenario[key] ?? 0;
  },

  setSelectedStep: (levelId, scenarioId, stepId) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => {
      if (state.selectedStepIdByScenario[key] === stepId) {
        return state;
      }
      return {
        selectedStepIdByScenario: {
          ...state.selectedStepIdByScenario,
          [key]: stepId,
        },
      };
    });
  },

  bumpSelectedStepRefreshNonce: (levelId, scenarioId) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => ({
      selectedStepRefreshNonceByScenario: {
        ...state.selectedStepRefreshNonceByScenario,
        [key]: (state.selectedStepRefreshNonceByScenario[key] ?? 0) + 1,
      },
    }));
  },

  setPanelOpen: (levelId, scenarioId, open) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => {
      if (state.panelOpenByScenario[key] === open) {
        return state;
      }
      return {
        panelOpenByScenario: {
          ...state.panelOpenByScenario,
          [key]: open,
        },
      };
    });
  },
}));
