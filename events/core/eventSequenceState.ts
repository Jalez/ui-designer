"use client";

import { create } from "zustand";

export type EventSequenceRecordingMode = "idle" | "single" | "continuous";
export const INITIAL_EVENT_SEQUENCE_STEP_ID = "__initial__";

export type AutoReplayState = {
  running: boolean;
  stepIndex: number;
  totalSteps: number;
};

export type ReplayStepDiagnosticStatus = "running" | "skipped" | "completed";

export type ReplayStepDiagnostic = {
  status: ReplayStepDiagnosticStatus;
  selector: string | null;
  reason: string | null;
  index: number | null;
  updatedAt: number;
};

export type ReplayDiagnosticsState = {
  activeSignature: string | null;
  activeStepId: string | null;
  totalSteps: number;
  startedAt: number | null;
  completedAt: number | null;
  stepStates: Record<string, ReplayStepDiagnostic>;
};

export type AutoReplayRequest = {
  levelId: number;
  runtimeKey: string;
  scenarioId: string;
  source: "manual" | "mount";
  totalSteps: number;
};

export type SequenceRuntimeState = {
  recordingMode: EventSequenceRecordingMode;
  activeIndex: number;
  pendingStepId: string | null;
  stepAccuracies: Record<string, number>;
  drawingVersion: number;
  stepAccuracyVersions: Record<string, number>;
  autoReplay: AutoReplayState | null;
  replayDiagnostics: ReplayDiagnosticsState;
};

export const EMPTY_SEQUENCE_RUNTIME_STATE: SequenceRuntimeState = {
  recordingMode: "idle",
  activeIndex: 0,
  pendingStepId: null,
  stepAccuracies: {},
  drawingVersion: 0,
  stepAccuracyVersions: {},
  autoReplay: null,
  replayDiagnostics: {
    activeSignature: null,
    activeStepId: null,
    totalSteps: 0,
    startedAt: null,
    completedAt: null,
    stepStates: {},
  },
};

export function getEventSequenceRuntimeKey(
  levelId: number,
  scenarioId: string,
  creatorMode: boolean,
): string {
  return `${levelId}:${scenarioId}:${creatorMode ? "creator" : "game"}`;
}

export function getEventSequenceScenarioUiKey(levelId: number, scenarioId: string): string {
  return `${levelId}:${scenarioId}`;
}

const AUTO_REPLAY_STORAGE_KEY = "eventSequence:autoReplayOnMount";

function loadAutoReplayOnMount(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(AUTO_REPLAY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function persistAutoReplayOnMount(value: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUTO_REPLAY_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function getRuntimeStateFromRecord(
  runtimeByKey: Record<string, SequenceRuntimeState>,
  key: string,
): SequenceRuntimeState {
  return runtimeByKey[key] ?? EMPTY_SEQUENCE_RUNTIME_STATE;
}

export function selectRuntimeState(
  runtimeByKey: Record<string, SequenceRuntimeState>,
  key: string | null | undefined,
): SequenceRuntimeState {
  return key ? getRuntimeStateFromRecord(runtimeByKey, key) : EMPTY_SEQUENCE_RUNTIME_STATE;
}

function waitForRuntimeStepAccuracy(
  runtimeKey: string,
  stepId: string,
  timeoutMs: number,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let settled = false;

    const finish = (resolver: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      unsub();
      resolver();
    };

    const check = () => {
      const value = getRuntimeStateFromRecord(
        useEventSequenceStore.getState().runtimeByKey,
        runtimeKey,
      ).stepAccuracies[stepId];
      if (typeof value === "number" && value !== -1) {
        finish(() => resolve(value));
      }
    };

    const unsub = useEventSequenceStore.subscribe(check);
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Timeout waiting for event ${stepId} accuracy`)));
    }, timeoutMs);

    check();
  });
}

type EventSequenceStore = {
  autoReplayMountRunKeys: Set<string>;
  autoReplayOnMountByScenario: Record<string, boolean>;
  panelOpenByScenario: Record<string, boolean>;
  queuedAutoReplayRequest: AutoReplayRequest | null;
  runtimeByKey: Record<string, SequenceRuntimeState>;
  selectedStepIdByScenario: Record<string, string | null>;
  getRuntimeState: (key: string) => SequenceRuntimeState;
  getSelectedStepIdForScenario: (levelId: number, scenarioId: string) => string | null;
  clearQueuedAutoReplayRequest: () => void;
  updateRuntimeState: (
    key: string,
    updater: (current: SequenceRuntimeState) => SequenceRuntimeState,
  ) => void;
  resetRuntimeState: (key: string) => void;
  resetRuntimeForKey: (key: string) => void;
  setRecordingMode: (key: string, mode: EventSequenceRecordingMode) => void;
  setPendingStep: (key: string, stepId: string | null) => void;
  setStepAccuracy: (key: string, stepId: string, accuracy: number) => void;
  markStepAccuracyPending: (key: string, stepId: string) => void;
  markStepAccuracyTimedOut: (key: string, stepId: string) => void;
  bumpDrawingVersion: (key: string) => void;
  advanceActiveIndex: (key: string, maxIndexExclusive: number) => void;
  setAutoReplayOnMount: (levelId: number, scenarioId: string, enabled: boolean) => void;
  setPanelOpen: (levelId: number, scenarioId: string, open: boolean) => void;
  setSelectedStep: (levelId: number, scenarioId: string, stepId: string | null) => void;
  clearAutoReplayMountedRunForScenario: (levelId: number, scenarioId: string) => void;
  hasAutoReplayMountedRun: (levelId: number, scenarioId: string) => boolean;
  markAutoReplayMountedRun: (levelId: number, scenarioId: string) => void;
  queueAutoReplayRequest: (request: AutoReplayRequest) => void;
  startAutoReplay: (key: string, totalSteps: number) => void;
  stopAutoReplay: (key: string) => void;
  setAutoReplayProgress: (key: string, stepIndex: number, totalSteps: number) => void;
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
  waitForStepAccuracy: (
    runtimeKey: string,
    stepId: string,
    timeoutMs?: number,
  ) => Promise<number>;
};

export const useEventSequenceStore = create<EventSequenceStore>((set, get) => ({
  autoReplayMountRunKeys: new Set<string>(),
  autoReplayOnMountByScenario: loadAutoReplayOnMount(),
  panelOpenByScenario: {},
  queuedAutoReplayRequest: null,
  runtimeByKey: {},
  selectedStepIdByScenario: {},

  getRuntimeState: (key) => getRuntimeStateFromRecord(get().runtimeByKey, key),
  getSelectedStepIdForScenario: (levelId, scenarioId) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    return get().selectedStepIdByScenario[key] ?? null;
  },
  clearQueuedAutoReplayRequest: () => set({ queuedAutoReplayRequest: null }),

  updateRuntimeState: (key, updater) => {
    set((state) => {
      const current = getRuntimeStateFromRecord(state.runtimeByKey, key);
      const next = updater(current);
      if (Object.is(next, current)) {
        return state;
      }
      return {
        runtimeByKey: {
          ...state.runtimeByKey,
          [key]: next,
        },
      };
    });
  },

  resetRuntimeState: (key) => {
    set((state) => {
      if (!(key in state.runtimeByKey)) {
        return state;
      }
      const runtimeByKey = { ...state.runtimeByKey };
      delete runtimeByKey[key];
      return { runtimeByKey };
    });
  },
  resetRuntimeForKey: (key) => {
    get().resetRuntimeState(key);
  },
  setRecordingMode: (key, mode) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      recordingMode: mode,
    }));
  },
  setPendingStep: (key, stepId) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      pendingStepId: stepId,
    }));
  },
  setStepAccuracy: (key, stepId, accuracy) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      stepAccuracies: { ...current.stepAccuracies, [stepId]: accuracy },
      stepAccuracyVersions: {
        ...current.stepAccuracyVersions,
        [stepId]: current.drawingVersion,
      },
    }));
  },
  markStepAccuracyPending: (key, stepId) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      stepAccuracies: { ...current.stepAccuracies, [stepId]: -1 },
    }));
  },
  markStepAccuracyTimedOut: (key, stepId) => {
    get().updateRuntimeState(key, (current) => {
      if (current.stepAccuracies[stepId] !== -1) {
        return current;
      }
      return {
        ...current,
        stepAccuracies: { ...current.stepAccuracies, [stepId]: -2 },
        pendingStepId: current.pendingStepId === stepId ? null : current.pendingStepId,
      };
    });
  },
  bumpDrawingVersion: (key) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      drawingVersion: current.drawingVersion + 1,
    }));
  },
  advanceActiveIndex: (key, maxIndexExclusive) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      activeIndex: Math.min(current.activeIndex + 1, maxIndexExclusive),
    }));
  },

  setAutoReplayOnMount: (levelId, scenarioId, enabled) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => {
      const autoReplayOnMountByScenario = {
        ...state.autoReplayOnMountByScenario,
        [key]: enabled,
      };
      persistAutoReplayOnMount(autoReplayOnMountByScenario);
      return { autoReplayOnMountByScenario };
    });
    if (!enabled) {
      get().clearAutoReplayMountedRunForScenario(levelId, scenarioId);
    }
  },

  setPanelOpen: (levelId, scenarioId, open) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => ({
      panelOpenByScenario: {
        ...state.panelOpenByScenario,
        [key]: open,
      },
    }));
  },

  setSelectedStep: (levelId, scenarioId, stepId) => {
    const key = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => ({
      selectedStepIdByScenario: {
        ...state.selectedStepIdByScenario,
        [key]: stepId,
      },
    }));
  },

  clearAutoReplayMountedRunForScenario: (levelId, scenarioId) => {
    const scenarioUiKey = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => {
      if (!state.autoReplayMountRunKeys.has(scenarioUiKey)) {
        return state;
      }
      const autoReplayMountRunKeys = new Set(state.autoReplayMountRunKeys);
      autoReplayMountRunKeys.delete(scenarioUiKey);
      return { autoReplayMountRunKeys };
    });
  },

  hasAutoReplayMountedRun: (levelId, scenarioId) =>
    get().autoReplayMountRunKeys.has(getEventSequenceScenarioUiKey(levelId, scenarioId)),

  markAutoReplayMountedRun: (levelId, scenarioId) => {
    const scenarioUiKey = getEventSequenceScenarioUiKey(levelId, scenarioId);
    set((state) => {
      if (state.autoReplayMountRunKeys.has(scenarioUiKey)) {
        return state;
      }
      const autoReplayMountRunKeys = new Set(state.autoReplayMountRunKeys);
      autoReplayMountRunKeys.add(scenarioUiKey);
      return { autoReplayMountRunKeys };
    });
  },
  queueAutoReplayRequest: (request) => {
    set({ queuedAutoReplayRequest: request });
  },

  startAutoReplay: (key, totalSteps) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      autoReplay: { running: true, stepIndex: 0, totalSteps },
    }));
  },

  stopAutoReplay: (key) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      autoReplay: null,
    }));
  },
  setAutoReplayProgress: (key, stepIndex, totalSteps) => {
    get().updateRuntimeState(key, (current) => {
      if (!current.autoReplay) {
        return current;
      }
      return {
        ...current,
        autoReplay: { ...current.autoReplay, stepIndex, totalSteps },
      };
    });
  },

  startReplayDiagnostics: (key, signature, totalSteps) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      replayDiagnostics: {
        activeSignature: signature,
        activeStepId: null,
        totalSteps,
        startedAt: Date.now(),
        completedAt: null,
        stepStates: {},
      },
    }));
  },

  markReplayStepRunning: (key, stepId, selector, index) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      replayDiagnostics: {
        ...current.replayDiagnostics,
        activeStepId: stepId,
        stepStates: {
          ...current.replayDiagnostics.stepStates,
          [stepId]: {
            status: "running",
            selector,
            reason: null,
            index,
            updatedAt: Date.now(),
          },
        },
      },
    }));
  },

  markReplayStepCompleted: (key, stepId, selector, index) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      replayDiagnostics: {
        ...current.replayDiagnostics,
        activeStepId:
          current.replayDiagnostics.activeStepId === stepId
            ? null
            : current.replayDiagnostics.activeStepId,
        stepStates: {
          ...current.replayDiagnostics.stepStates,
          [stepId]: {
            status: "completed",
            selector,
            reason: null,
            index,
            updatedAt: Date.now(),
          },
        },
      },
    }));
  },

  markReplayStepSkipped: (key, stepId, selector, index, reason) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      replayDiagnostics: {
        ...current.replayDiagnostics,
        activeStepId:
          current.replayDiagnostics.activeStepId === stepId
            ? null
            : current.replayDiagnostics.activeStepId,
        stepStates: {
          ...current.replayDiagnostics.stepStates,
          [stepId]: {
            status: "skipped",
            selector,
            reason,
            index,
            updatedAt: Date.now(),
          },
        },
      },
    }));
  },

  finishReplayDiagnostics: (key, signature) => {
    get().updateRuntimeState(key, (current) => {
      if (current.replayDiagnostics.activeSignature !== signature) {
        return current;
      }
      return {
        ...current,
        replayDiagnostics: {
          ...current.replayDiagnostics,
          activeSignature: null,
          activeStepId: null,
          completedAt: Date.now(),
        },
      };
    });
  },

  clearReplayDiagnostics: (key) => {
    get().updateRuntimeState(key, (current) => ({
      ...current,
      replayDiagnostics: EMPTY_SEQUENCE_RUNTIME_STATE.replayDiagnostics,
    }));
  },

  waitForStepAccuracy: (runtimeKey, stepId, timeoutMs = 10_000) =>
    waitForRuntimeStepAccuracy(runtimeKey, stepId, timeoutMs),
}));

export function isStepStale(state: SequenceRuntimeState, stepId: string): boolean {
  const measuredVersion = state.stepAccuracyVersions[stepId];
  return measuredVersion !== undefined && measuredVersion < state.drawingVersion;
}
