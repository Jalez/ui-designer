"use client";

import { create } from "zustand";

import type { StepAccuracyState } from "./eventSequenceMetricsTypes";

export type EventSequenceCaptureSlice = {
  drawingVersion: number;
  stepAccuraciesByStepId: Record<string, StepAccuracyState>;
  /** Drawboard `drawingVersion` when the last full replay journey completed (staleness vs current draw). */
  lastReplayCompletedDrawingVersion: number | null;
};

export const EMPTY_EVENT_SEQUENCE_CAPTURE_SLICE: EventSequenceCaptureSlice = {
  drawingVersion: 0,
  stepAccuraciesByStepId: {},
  lastReplayCompletedDrawingVersion: null,
};

function getCaptureFromRecord(
  captureByKey: Record<string, EventSequenceCaptureSlice>,
  key: string,
): EventSequenceCaptureSlice {
  return captureByKey[key] ?? EMPTY_EVENT_SEQUENCE_CAPTURE_SLICE;
}

export function selectCaptureState(
  captureByKey: Record<string, EventSequenceCaptureSlice>,
  key: string | null | undefined,
): EventSequenceCaptureSlice {
  return key ? getCaptureFromRecord(captureByKey, key) : EMPTY_EVENT_SEQUENCE_CAPTURE_SLICE;
}

export function getStepAccuracyEntryFromCapture(
  state: EventSequenceCaptureSlice,
  stepId: string | null | undefined,
): StepAccuracyState | null {
  if (!stepId) {
    return null;
  }
  return state.stepAccuraciesByStepId[stepId] ?? null;
}

export function getStepAccuracyValueFromCapture(
  state: EventSequenceCaptureSlice,
  stepId: string | null | undefined,
): number | null {
  return getStepAccuracyEntryFromCapture(state, stepId)?.accuracy ?? null;
}

export function isStepStaleInCapture(state: EventSequenceCaptureSlice, stepId: string): boolean {
  const measuredVersion = getStepAccuracyEntryFromCapture(state, stepId)?.version;
  return measuredVersion !== undefined && measuredVersion < state.drawingVersion;
}

type EventSequenceCaptureStore = {
  captureByKey: Record<string, EventSequenceCaptureSlice>;
  getCaptureState: (key: string) => EventSequenceCaptureSlice;
  updateCaptureState: (
    key: string,
    updater: (current: EventSequenceCaptureSlice) => EventSequenceCaptureSlice,
  ) => void;
  clearCaptureStateForRuntimeKey: (key: string) => void;
  setStepAccuracy: (key: string, stepId: string, accuracy: number) => void;
  markStepAccuracyPending: (key: string, stepId: string) => void;
  markStepAccuracyTimedOut: (key: string, stepId: string) => void;
  bumpDrawingVersion: (key: string) => void;
  recordReplayJourneyCompletedBaseline: (key: string) => void;
};

export const useEventSequenceCaptureStore = create<EventSequenceCaptureStore>((set, get) => ({
  captureByKey: {},

  getCaptureState: (key) => getCaptureFromRecord(get().captureByKey, key),

  updateCaptureState: (key, updater) => {
    set((state) => {
      const current = getCaptureFromRecord(state.captureByKey, key);
      const next = updater(current);
      if (Object.is(next, current)) {
        return state;
      }
      return {
        captureByKey: {
          ...state.captureByKey,
          [key]: next,
        },
      };
    });
  },

  clearCaptureStateForRuntimeKey: (key) => {
    set((state) => {
      if (!(key in state.captureByKey)) {
        return state;
      }
      const captureByKey = { ...state.captureByKey };
      delete captureByKey[key];
      return { captureByKey };
    });
  },

  setStepAccuracy: (key, stepId, accuracy) => {
    get().updateCaptureState(key, (current) => ({
      ...current,
      stepAccuraciesByStepId: {
        ...current.stepAccuraciesByStepId,
        [stepId]: {
          accuracy,
          version: current.drawingVersion,
        },
      },
    }));
  },

  markStepAccuracyPending: (key, stepId) => {
    get().updateCaptureState(key, (current) => ({
      ...current,
      stepAccuraciesByStepId: {
        ...current.stepAccuraciesByStepId,
        [stepId]: {
          accuracy: -1,
          version: current.drawingVersion,
        },
      },
    }));
  },

  markStepAccuracyTimedOut: (key, stepId) => {
    get().updateCaptureState(key, (current) => {
      if (getStepAccuracyValueFromCapture(current, stepId) !== -1) {
        return current;
      }
      return {
        ...current,
        stepAccuraciesByStepId: {
          ...current.stepAccuraciesByStepId,
          [stepId]: {
            accuracy: -2,
            version: current.drawingVersion,
          },
        },
      };
    });
  },

  bumpDrawingVersion: (key) => {
    get().updateCaptureState(key, (current) => ({
      ...current,
      drawingVersion: current.drawingVersion + 1,
    }));
  },

  recordReplayJourneyCompletedBaseline: (key) => {
    get().updateCaptureState(key, (current) => ({
      ...current,
      lastReplayCompletedDrawingVersion: current.drawingVersion,
    }));
  },
}));

export function getStepAccuracyEntry(
  runtimeKey: string,
  stepId: string | null | undefined,
): StepAccuracyState | null {
  return getStepAccuracyEntryFromCapture(
    useEventSequenceCaptureStore.getState().getCaptureState(runtimeKey),
    stepId,
  );
}

export function getStepAccuracyValue(
  runtimeKey: string,
  stepId: string | null | undefined,
): number | null {
  return getStepAccuracyValueFromCapture(
    useEventSequenceCaptureStore.getState().getCaptureState(runtimeKey),
    stepId,
  );
}

export function isStepStale(runtimeKey: string, stepId: string): boolean {
  return isStepStaleInCapture(
    useEventSequenceCaptureStore.getState().getCaptureState(runtimeKey),
    stepId,
  );
}

export function waitForStepAccuracy(
  runtimeKey: string,
  stepId: string,
  timeoutMs = 10_000,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let settled = false;
    const finish = (resolver: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolver();
    };
    const check = () => {
      const value = getStepAccuracyValue(runtimeKey, stepId);
      if (typeof value === "number" && value !== -1) {
        finish(() => resolve(value));
      }
    };
    const unsub = useEventSequenceCaptureStore.subscribe(check);
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Timeout waiting for event ${stepId} accuracy`)));
    }, timeoutMs);
    check();
  });
}
