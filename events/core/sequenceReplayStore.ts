"use client";

import { create } from "zustand";

import {
  EMPTY_REPLAY_DIAGNOSTICS,
  EMPTY_REPLAY_JOURNEY,
  type ReplayBatchSessionState,
  type ReplayDiagnosticsState,
  type ReplayJourneyState,
} from "./eventSequenceReplayTypes";

/**
 * Single store for "a replay run is happening right now": global `isRunning`, the
 * per-runtime batch correlation (runId + step progress), the journey shown in the
 * timeline header, and per-step diagnostics.
 *
 * Lifecycle methods (`startBatch` / `endBatch` / `markJourneyCompleted`) own the
 * atomic multi-field write so callers don't need a facade layer.
 */
type SequenceReplayStore = {
  isRunning: boolean;
  batchByKey: Record<string, ReplayBatchSessionState | null>;
  journeyByKey: Record<string, ReplayJourneyState>;
  diagnosticsByKey: Record<string, ReplayDiagnosticsState>;

  getBatch: (key: string) => ReplayBatchSessionState | null;
  getJourney: (key: string) => ReplayJourneyState;
  getDiagnostics: (key: string) => ReplayDiagnosticsState;

  startBatch: (key: string, totalSteps: number, originalSelectedStepId: string | null) => void;
  endBatch: (key: string) => void;
  markJourneyCompleted: (key: string, totalSteps: number) => void;
  setBatchProgress: (key: string, stepIndex: number, totalSteps: number) => void;
  setJourneyProgress: (key: string, stepIndex: number, totalSteps: number) => void;

  startDiagnostics: (key: string, signature: string, totalSteps: number) => void;
  markStepRunning: (key: string, stepId: string, selector: string | null, index: number | null) => void;
  markStepCompleted: (key: string, stepId: string, selector: string | null, index: number | null) => void;
  markStepSkipped: (
    key: string,
    stepId: string,
    selector: string | null,
    index: number | null,
    reason: string | null,
  ) => void;
  finishDiagnostics: (key: string, signature: string) => void;
  clearDiagnostics: (key: string) => void;

  clearForKey: (key: string) => void;
};

function journey(byKey: Record<string, ReplayJourneyState>, key: string): ReplayJourneyState {
  return byKey[key] ?? EMPTY_REPLAY_JOURNEY;
}

function diagnostics(byKey: Record<string, ReplayDiagnosticsState>, key: string): ReplayDiagnosticsState {
  return byKey[key] ?? EMPTY_REPLAY_DIAGNOSTICS;
}

export const useSequenceReplayStore = create<SequenceReplayStore>((set, get) => ({
  isRunning: false,
  batchByKey: {},
  journeyByKey: {},
  diagnosticsByKey: {},

  getBatch: (key) => get().batchByKey[key] ?? null,
  getJourney: (key) => journey(get().journeyByKey, key),
  getDiagnostics: (key) => diagnostics(get().diagnosticsByKey, key),

  startBatch: (key, totalSteps, originalSelectedStepId) => {
    set((state) => ({
      isRunning: true,
      batchByKey: {
        ...state.batchByKey,
        [key]: { runId: Date.now(), originalSelectedStepId, stepIndex: 0, totalSteps },
      },
      journeyByKey: {
        ...state.journeyByKey,
        [key]: {
          active: true,
          currentStep: 0,
          totalSteps,
          lastCompletedAt: journey(state.journeyByKey, key).lastCompletedAt,
        },
      },
    }));
  },

  endBatch: (key) => {
    set((state) => {
      const batchByKey = { ...state.batchByKey };
      delete batchByKey[key];
      const current = journey(state.journeyByKey, key);
      const nextJourney = current.active
        ? { ...current, active: false, currentStep: 0, totalSteps: 0 }
        : current;
      return {
        isRunning: false,
        batchByKey,
        journeyByKey: { ...state.journeyByKey, [key]: nextJourney },
      };
    });
  },

  markJourneyCompleted: (key, totalSteps) => {
    set((state) => ({
      journeyByKey: {
        ...state.journeyByKey,
        [key]: {
          active: false,
          currentStep: totalSteps,
          totalSteps,
          lastCompletedAt: Date.now(),
        },
      },
    }));
  },

  setBatchProgress: (key, stepIndex, totalSteps) => {
    set((state) => {
      const current = state.batchByKey[key];
      if (!current) {
        return state;
      }
      return {
        batchByKey: { ...state.batchByKey, [key]: { ...current, stepIndex, totalSteps } },
      };
    });
  },

  setJourneyProgress: (key, stepIndex, totalSteps) => {
    set((state) => ({
      journeyByKey: {
        ...state.journeyByKey,
        [key]: {
          ...journey(state.journeyByKey, key),
          active: true,
          currentStep: stepIndex,
          totalSteps,
        },
      },
    }));
  },

  startDiagnostics: (key, signature, totalSteps) => {
    set((state) => ({
      diagnosticsByKey: {
        ...state.diagnosticsByKey,
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

  markStepRunning: (key, stepId, selector, index) => {
    set((state) => {
      const current = diagnostics(state.diagnosticsByKey, key);
      return {
        diagnosticsByKey: {
          ...state.diagnosticsByKey,
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

  markStepCompleted: (key, stepId, selector, index) => {
    set((state) => {
      const current = diagnostics(state.diagnosticsByKey, key);
      return {
        diagnosticsByKey: {
          ...state.diagnosticsByKey,
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

  markStepSkipped: (key, stepId, selector, index, reason) => {
    set((state) => {
      const current = diagnostics(state.diagnosticsByKey, key);
      return {
        diagnosticsByKey: {
          ...state.diagnosticsByKey,
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

  finishDiagnostics: (key, signature) => {
    set((state) => {
      const current = diagnostics(state.diagnosticsByKey, key);
      if (current.activeSignature !== signature) {
        return state;
      }
      return {
        diagnosticsByKey: {
          ...state.diagnosticsByKey,
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

  clearDiagnostics: (key) => {
    set((state) => ({
      diagnosticsByKey: { ...state.diagnosticsByKey, [key]: EMPTY_REPLAY_DIAGNOSTICS },
    }));
  },

  clearForKey: (key) => {
    set((state) => {
      const hadBatch = Boolean(state.batchByKey[key]);
      const batchByKey = { ...state.batchByKey };
      const journeyByKey = { ...state.journeyByKey };
      const diagnosticsByKey = { ...state.diagnosticsByKey };
      delete batchByKey[key];
      delete journeyByKey[key];
      delete diagnosticsByKey[key];
      return {
        isRunning: hadBatch ? false : state.isRunning,
        batchByKey,
        journeyByKey,
        diagnosticsByKey,
      };
    });
  },
}));
