"use client";

import { create } from "zustand";

import type { EventSequenceRecordingMode } from "./eventSequenceReplayTypes";

type EventSequenceRecordingStore = {
  recordingModeByKey: Record<string, EventSequenceRecordingMode>;
  getRecordingMode: (key: string) => EventSequenceRecordingMode;
  setRecordingMode: (key: string, mode: EventSequenceRecordingMode) => void;
  clearRecordingModeForKey: (key: string) => void;
};

export const useEventSequenceRecordingStore = create<EventSequenceRecordingStore>((set, get) => ({
  recordingModeByKey: {},

  getRecordingMode: (key) => get().recordingModeByKey[key] ?? "idle",

  setRecordingMode: (key, mode) => {
    set((state) => ({
      recordingModeByKey: {
        ...state.recordingModeByKey,
        [key]: mode,
      },
    }));
  },

  clearRecordingModeForKey: (key) => {
    set((state) => {
      if (!(key in state.recordingModeByKey)) {
        return state;
      }
      const recordingModeByKey = { ...state.recordingModeByKey };
      delete recordingModeByKey[key];
      return { recordingModeByKey };
    });
  },
}));
