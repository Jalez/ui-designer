"use client";

import { create } from "zustand";

import type { AutoReplayRequest } from "./eventSequenceReplayTypes";
import { getEventSequenceScenarioUiKey } from "./eventSequenceReplayTypes";

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

type EventSequenceAutoRunPrefsStore = {
  autoReplayMountRunKeys: Set<string>;
  autoReplayOnMountByScenario: Record<string, boolean>;
  queuedAutoReplayRequest: AutoReplayRequest | null;
  clearQueuedAutoReplayRequest: () => void;
  queueAutoReplayRequest: (request: AutoReplayRequest) => void;
  setAutoReplayOnMount: (levelId: number, scenarioId: string, enabled: boolean) => void;
  clearAutoReplayMountedRunForScenario: (levelId: number, scenarioId: string) => void;
  hasAutoReplayMountedRun: (levelId: number, scenarioId: string) => boolean;
  markAutoReplayMountedRun: (levelId: number, scenarioId: string) => void;
};

export const useEventSequenceAutoRunPrefsStore = create<EventSequenceAutoRunPrefsStore>((set, get) => ({
  autoReplayMountRunKeys: new Set<string>(),
  autoReplayOnMountByScenario: loadAutoReplayOnMount(),
  queuedAutoReplayRequest: null,

  clearQueuedAutoReplayRequest: () => set({ queuedAutoReplayRequest: null }),

  queueAutoReplayRequest: (request) => {
    set({ queuedAutoReplayRequest: request });
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

  hasAutoReplayMountedRun: (levelId, scenarioId) => (
    get().autoReplayMountRunKeys.has(getEventSequenceScenarioUiKey(levelId, scenarioId))
  ),

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
}));
