"use client";

import { create } from "zustand";

/**
 * Registers an async per-step solution capture runner per `runtimeKey`.
 * Replay can ask for the current step's solution image on demand when the
 * current fingerprinted URL is missing.
 */
export type BrowserSolutionStepCaptureRunner = (stepId: string) => Promise<string | null>;

type BrowserSolutionStepCaptureStore = {
  runnerByKey: Record<string, BrowserSolutionStepCaptureRunner | null>;
  registerRunner: (key: string, runner: BrowserSolutionStepCaptureRunner | null) => void;
  getRunner: (key: string) => BrowserSolutionStepCaptureRunner | null;
};

export const useBrowserSolutionPreflightStore = create<BrowserSolutionStepCaptureStore>((set, get) => ({
  runnerByKey: {},
  registerRunner: (key, runner) => {
    if (!key) return;
    set((state) => ({ runnerByKey: { ...state.runnerByKey, [key]: runner } }));
  },
  getRunner: (key) => (key ? get().runnerByKey[key] ?? null : null),
}));
