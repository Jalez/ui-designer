"use client";

import { create } from "zustand";

type EventSequenceRunStore = {
  /** True while an event-sequence replay batch is active (global; one session at a time). */
  isRunning: boolean;
  setEventSequenceRunning: (running: boolean) => void;
};

export const useEventSequenceRunStore = create<EventSequenceRunStore>((set) => ({
  isRunning: false,
  setEventSequenceRunning: (running) => set({ isRunning: running }),
}));
