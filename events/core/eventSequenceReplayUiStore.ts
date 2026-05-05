"use client";

import { create } from "zustand";

import {
  EMPTY_REPLAY_DIAGNOSTICS,
  EMPTY_REPLAY_JOURNEY,
  type ReplayDiagnosticsState,
  type ReplayJourneyState,
} from "./eventSequenceReplayTypes";

type EventSequenceReplayUiStore = {
  replayJourneyByKey: Record<string, ReplayJourneyState>;
  replayDiagnosticsByKey: Record<string, ReplayDiagnosticsState>;
  getReplayJourney: (key: string) => ReplayJourneyState;
  getReplayDiagnostics: (key: string) => ReplayDiagnosticsState;
  setReplayJourneyProgress: (key: string, stepIndex: number, totalSteps: number) => void;
  markReplayJourneyCompletedSlice: (key: string, totalSteps: number) => void;
  startReplayJourneyForBatch: (key: string, totalSteps: number) => void;
  endReplayJourneyFromBatch: (key: string) => void;
  startReplayDiagnostics: (key: string, signature: string, totalSteps: number) => void;
  markReplayStepRunning: (
    key: string,
    stepId: string,
    selector: string | null,
    index: number | null,
  ) => void;
  markReplayStepCompleted: (
    key: string,
    stepId: string,
    selector: string | null,
    index: number | null,
  ) => void;
  markReplayStepSkipped: (
    key: string,
    stepId: string,
    selector: string | null,
    index: number | null,
    reason: string | null,
  ) => void;
  finishReplayDiagnostics: (key: string, signature: string) => void;
  clearReplayDiagnostics: (key: string) => void;
  clearReplayUiForKey: (key: string) => void;
};

function journeyFromRecord(
  replayJourneyByKey: Record<string, ReplayJourneyState>,
  key: string,
): ReplayJourneyState {
  return replayJourneyByKey[key] ?? EMPTY_REPLAY_JOURNEY;
}

function diagnosticsFromRecord(
  replayDiagnosticsByKey: Record<string, ReplayDiagnosticsState>,
  key: string,
): ReplayDiagnosticsState {
  return replayDiagnosticsByKey[key] ?? EMPTY_REPLAY_DIAGNOSTICS;
}

export const useEventSequenceReplayUiStore = create<EventSequenceReplayUiStore>((set, get) => ({
  replayJourneyByKey: {},
  replayDiagnosticsByKey: {},

  getReplayJourney: (key) => journeyFromRecord(get().replayJourneyByKey, key),

  getReplayDiagnostics: (key) => diagnosticsFromRecord(get().replayDiagnosticsByKey, key),

  startReplayJourneyForBatch: (key, totalSteps) => {
    set((state) => {
      const prev = journeyFromRecord(state.replayJourneyByKey, key);
      return {
        replayJourneyByKey: {
          ...state.replayJourneyByKey,
          [key]: {
            active: true,
            currentStep: 0,
            totalSteps,
            lastCompletedAt: prev.lastCompletedAt,
          },
        },
      };
    });
  },

  endReplayJourneyFromBatch: (key) => {
    set((state) => {
      const current = journeyFromRecord(state.replayJourneyByKey, key);
      if (!current.active) {
        return state;
      }
      return {
        replayJourneyByKey: {
          ...state.replayJourneyByKey,
          [key]: {
            ...current,
            active: false,
            currentStep: 0,
            totalSteps: 0,
          },
        },
      };
    });
  },

  setReplayJourneyProgress: (key, stepIndex, totalSteps) => {
    set((state) => ({
      replayJourneyByKey: {
        ...state.replayJourneyByKey,
        [key]: {
          ...journeyFromRecord(state.replayJourneyByKey, key),
          active: true,
          currentStep: stepIndex,
          totalSteps,
        },
      },
    }));
  },

  markReplayJourneyCompletedSlice: (key, totalSteps) => {
    set((state) => ({
      replayJourneyByKey: {
        ...state.replayJourneyByKey,
        [key]: {
          active: false,
          currentStep: totalSteps,
          totalSteps,
          lastCompletedAt: Date.now(),
        },
      },
    }));
  },

  startReplayDiagnostics: (key, signature, totalSteps) => {
    set((state) => ({
      replayDiagnosticsByKey: {
        ...state.replayDiagnosticsByKey,
        [key]: {
          activeSignature: signature,
          activeStepId: null,
          totalSteps,
          startedAt: Date.now(),
          completedAt: null,
          stepStates: {},
        },
      },
    }));
  },

  markReplayStepRunning: (key, stepId, selector, index) => {
    set((state) => {
      const current = diagnosticsFromRecord(state.replayDiagnosticsByKey, key);
      return {
        replayDiagnosticsByKey: {
          ...state.replayDiagnosticsByKey,
          [key]: {
            ...current,
            activeStepId: stepId,
            stepStates: {
              ...current.stepStates,
              [stepId]: {
                status: "running",
                selector,
                reason: null,
                index,
                updatedAt: Date.now(),
              },
            },
          },
        },
      };
    });
  },

  markReplayStepCompleted: (key, stepId, selector, index) => {
    set((state) => {
      const current = diagnosticsFromRecord(state.replayDiagnosticsByKey, key);
      return {
        replayDiagnosticsByKey: {
          ...state.replayDiagnosticsByKey,
          [key]: {
            ...current,
            activeStepId: current.activeStepId === stepId ? null : current.activeStepId,
            stepStates: {
              ...current.stepStates,
              [stepId]: {
                status: "completed",
                selector,
                reason: null,
                index,
                updatedAt: Date.now(),
              },
            },
          },
        },
      };
    });
  },

  markReplayStepSkipped: (key, stepId, selector, index, reason) => {
    set((state) => {
      const current = diagnosticsFromRecord(state.replayDiagnosticsByKey, key);
      return {
        replayDiagnosticsByKey: {
          ...state.replayDiagnosticsByKey,
          [key]: {
            ...current,
            activeStepId: current.activeStepId === stepId ? null : current.activeStepId,
            stepStates: {
              ...current.stepStates,
              [stepId]: {
                status: "skipped",
                selector,
                reason,
                index,
                updatedAt: Date.now(),
              },
            },
          },
        },
      };
    });
  },

  finishReplayDiagnostics: (key, signature) => {
    set((state) => {
      const current = diagnosticsFromRecord(state.replayDiagnosticsByKey, key);
      if (current.activeSignature !== signature) {
        return state;
      }
      return {
        replayDiagnosticsByKey: {
          ...state.replayDiagnosticsByKey,
          [key]: {
            ...current,
            activeSignature: null,
            activeStepId: null,
            completedAt: Date.now(),
          },
        },
      };
    });
  },

  clearReplayDiagnostics: (key) => {
    set((state) => ({
      replayDiagnosticsByKey: {
        ...state.replayDiagnosticsByKey,
        [key]: EMPTY_REPLAY_DIAGNOSTICS,
      },
    }));
  },

  clearReplayUiForKey: (key) => {
    set((state) => {
      const hasJourney = key in state.replayJourneyByKey;
      const hasDiag = key in state.replayDiagnosticsByKey;
      if (!hasJourney && !hasDiag) {
        return state;
      }
      const replayJourneyByKey = { ...state.replayJourneyByKey };
      const replayDiagnosticsByKey = { ...state.replayDiagnosticsByKey };
      delete replayJourneyByKey[key];
      delete replayDiagnosticsByKey[key];
      return { replayJourneyByKey, replayDiagnosticsByKey };
    });
  },
}));
