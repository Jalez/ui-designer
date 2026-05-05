"use client";

import { create } from "zustand";

type EventSequenceGameProgressStore = {
  activeIndexByKey: Record<string, number>;
  pendingStepIdByKey: Record<string, string | null>;
  setPendingStep: (key: string, stepId: string | null) => void;
  advanceActiveIndex: (key: string, maxIndexExclusive: number) => void;
  clearPendingIfMatches: (key: string, stepId: string) => void;
  tryAdvanceAfterVerifiedAccuracy: (params: {
    key: string;
    isRunning: boolean;
    gameplayStepId: string | null;
    pendingStepId: string | null;
    accuracy: number;
    scenarioSequenceLength: number;
  }) => void;
  clearGameProgressForKey: (key: string) => void;
};

export const useEventSequenceGameProgressStore = create<EventSequenceGameProgressStore>((set, get) => ({
  activeIndexByKey: {},
  pendingStepIdByKey: {},

  setPendingStep: (key, stepId) => {
    set((state) => ({
      pendingStepIdByKey: {
        ...state.pendingStepIdByKey,
        [key]: stepId,
      },
    }));
  },

  advanceActiveIndex: (key, maxIndexExclusive) => {
    set((state) => {
      const current = state.activeIndexByKey[key] ?? 0;
      return {
        activeIndexByKey: {
          ...state.activeIndexByKey,
          [key]: Math.min(current + 1, maxIndexExclusive),
        },
      };
    });
  },

  clearPendingIfMatches: (key, stepId) => {
    set((state) => {
      const pending = state.pendingStepIdByKey[key] ?? null;
      if (pending !== stepId) {
        return state;
      }
      return {
        pendingStepIdByKey: {
          ...state.pendingStepIdByKey,
          [key]: null,
        },
      };
    });
  },

  tryAdvanceAfterVerifiedAccuracy: ({
    key,
    isRunning,
    gameplayStepId,
    pendingStepId,
    accuracy,
    scenarioSequenceLength,
  }) => {
    if (isRunning || !gameplayStepId || pendingStepId !== gameplayStepId || accuracy < 99.5) {
      return;
    }
    set((state) => ({
      pendingStepIdByKey: {
        ...state.pendingStepIdByKey,
        [key]: null,
      },
      activeIndexByKey: {
        ...state.activeIndexByKey,
        [key]: Math.min((state.activeIndexByKey[key] ?? 0) + 1, scenarioSequenceLength),
      },
    }));
  },

  clearGameProgressForKey: (key) => {
    set((state) => {
      const hasActive = key in state.activeIndexByKey;
      const hasPending = key in state.pendingStepIdByKey;
      if (!hasActive && !hasPending) {
        return state;
      }
      const activeIndexByKey = { ...state.activeIndexByKey };
      const pendingStepIdByKey = { ...state.pendingStepIdByKey };
      delete activeIndexByKey[key];
      delete pendingStepIdByKey[key];
      return { activeIndexByKey, pendingStepIdByKey };
    });
  },
}));
