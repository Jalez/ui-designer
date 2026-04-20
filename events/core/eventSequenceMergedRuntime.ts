"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  EMPTY_REPLAY_DIAGNOSTICS,
  EMPTY_REPLAY_JOURNEY,
  EMPTY_SEQUENCE_RUNTIME_STATE,
  type SequenceRuntimeState,
} from "./eventSequenceReplayTypes";
import { useEventSequenceGameProgressStore } from "./eventSequenceGameProgressStore";
import { useEventSequenceRecordingStore } from "./eventSequenceRecordingStore";
import { useEventSequenceReplayBatchStore } from "./eventSequenceReplayBatchStore";
import { useEventSequenceReplayUiStore } from "./eventSequenceReplayUiStore";

export function getMergedSequenceRuntimeState(runtimeKey: string | null): SequenceRuntimeState {
  if (!runtimeKey) {
    return EMPTY_SEQUENCE_RUNTIME_STATE;
  }
  return {
    recordingMode: useEventSequenceRecordingStore.getState().getRecordingMode(runtimeKey),
    activeIndex: useEventSequenceGameProgressStore.getState().activeIndexByKey[runtimeKey] ?? 0,
    pendingStepId: useEventSequenceGameProgressStore.getState().pendingStepIdByKey[runtimeKey] ?? null,
    replayBatchSession: useEventSequenceReplayBatchStore.getState().getReplayBatchSession(runtimeKey),
    replayJourney: useEventSequenceReplayUiStore.getState().getReplayJourney(runtimeKey),
    replayDiagnostics: useEventSequenceReplayUiStore.getState().getReplayDiagnostics(runtimeKey),
  };
}

/**
 * Subscribe to the per-runtime fields that previously lived in `runtimeByKey`.
 * Narrow selectors avoid coupling unrelated runtimes.
 */
export function useMergedSequenceRuntimeState(runtimeKey: string | null): SequenceRuntimeState {
  const recordingMode = useEventSequenceRecordingStore((s) => (
    runtimeKey ? (s.recordingModeByKey[runtimeKey] ?? "idle") : "idle"
  ));
  const { activeIndex, pendingStepId } = useEventSequenceGameProgressStore(
    useShallow((s) => (
      runtimeKey
        ? {
          activeIndex: s.activeIndexByKey[runtimeKey] ?? 0,
          pendingStepId: s.pendingStepIdByKey[runtimeKey] ?? null,
        }
        : { activeIndex: 0, pendingStepId: null as string | null }
    )),
  );
  const replayBatchSession = useEventSequenceReplayBatchStore((s) => (
    runtimeKey ? (s.replayBatchSessionByKey[runtimeKey] ?? null) : null
  ));
  const replayJourney = useEventSequenceReplayUiStore((s) => (
    runtimeKey ? (s.replayJourneyByKey[runtimeKey] ?? EMPTY_REPLAY_JOURNEY) : EMPTY_REPLAY_JOURNEY
  ));
  const replayDiagnostics = useEventSequenceReplayUiStore((s) => (
    runtimeKey
      ? (s.replayDiagnosticsByKey[runtimeKey] ?? EMPTY_REPLAY_DIAGNOSTICS)
      : EMPTY_REPLAY_DIAGNOSTICS
  ));

  return useMemo(
    (): SequenceRuntimeState => ({
      recordingMode,
      activeIndex,
      pendingStepId,
      replayBatchSession,
      replayJourney,
      replayDiagnostics,
    }),
    [activeIndex, pendingStepId, recordingMode, replayBatchSession, replayDiagnostics, replayJourney],
  );
}
