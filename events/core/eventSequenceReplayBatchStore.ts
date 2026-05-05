"use client";

import { create } from "zustand";

import type { ReplayBatchSessionState } from "./eventSequenceReplayTypes";

type EventSequenceReplayBatchStore = {
  replayBatchSessionByKey: Record<string, ReplayBatchSessionState | null>;
  getReplayBatchSession: (key: string) => ReplayBatchSessionState | null;
  setReplayBatchSession: (key: string, session: ReplayBatchSessionState | null) => void;
  setReplayBatchSessionProgress: (key: string, stepIndex: number, totalSteps: number) => void;
  clearReplayBatchForKey: (key: string) => void;
};

function getSessionFromRecord(
  replayBatchSessionByKey: Record<string, ReplayBatchSessionState | null>,
  key: string,
): ReplayBatchSessionState | null {
  return replayBatchSessionByKey[key] ?? null;
}

export const useEventSequenceReplayBatchStore = create<EventSequenceReplayBatchStore>((set, get) => ({
  replayBatchSessionByKey: {},

  getReplayBatchSession: (key) => getSessionFromRecord(get().replayBatchSessionByKey, key),

  setReplayBatchSession: (key, session) => {
    set((state) => {
      if (session === null) {
        if (!(key in state.replayBatchSessionByKey)) {
          return state;
        }
        const replayBatchSessionByKey = { ...state.replayBatchSessionByKey };
        delete replayBatchSessionByKey[key];
        return { replayBatchSessionByKey };
      }
      return {
        replayBatchSessionByKey: {
          ...state.replayBatchSessionByKey,
          [key]: session,
        },
      };
    });
  },

  setReplayBatchSessionProgress: (key, stepIndex, totalSteps) => {
    set((state) => {
      const current = getSessionFromRecord(state.replayBatchSessionByKey, key);
      if (!current) {
        return state;
      }
      return {
        replayBatchSessionByKey: {
          ...state.replayBatchSessionByKey,
          [key]: { ...current, stepIndex, totalSteps },
        },
      };
    });
  },

  clearReplayBatchForKey: (key) => {
    set((state) => {
      if (!(key in state.replayBatchSessionByKey)) {
        return state;
      }
      const replayBatchSessionByKey = { ...state.replayBatchSessionByKey };
      delete replayBatchSessionByKey[key];
      return { replayBatchSessionByKey };
    });
  },
}));
