"use client";

import { create } from "zustand";

import { getEventSequenceScenarioUiKey } from "./eventSequenceReplayTypes";

type EventSequenceTimelineUiStore = {
  selectedStepIdByScenario: Record<string, string | null>;
  panelOpenByScenario: Record<string, boolean>;
  getSelectedStepIdForScenario: (levelId: number, scenarioId: string) => string | null;
  setSelectedStep: (levelId: number, scenarioId: string, stepId: string | null) => void;
  setPanelOpen: (levelId: number, scenarioId: string, open: boolean) => void;
};

export const useEventSequenceTimelineUiStore = create<EventSequenceTimelineUiStore>((set, get) => ({
  selectedStepIdByScenario: {},
  panelOpenByScenario: {},

  getSelectedStepIdForScenario: (levelId, scenarioId) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    return get().selectedStepIdByScenario[key] ?? null;
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
