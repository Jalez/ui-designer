/** Types shared by replay / recording / game-progress event-sequence stores (no Zustand). */

export type EventSequenceRecordingMode = "idle" | "single" | "continuous";

export const INITIAL_EVENT_SEQUENCE_STEP_ID = "__initial__";

/** Batch replay correlation (no `running` flag — use `useEventSequenceRunStore` `isRunning`). */
export type ReplayBatchSessionState = {
  runId: number;
  originalSelectedStepId: string | null;
  stepIndex: number;
  totalSteps: number;
};

/** @deprecated Use `ReplayBatchSessionState` */
export type AutoReplayState = ReplayBatchSessionState;

export type ReplayJourneyState = {
  active: boolean;
  currentStep: number;
  totalSteps: number;
  lastCompletedAt: number | null;
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
  originalSelectedStepId: string | null;
  runtimeKey: string;
  scenarioId: string;
  source: "manual" | "mount";
  totalSteps: number;
};

/** Merged per-`runtimeKey` view for UI that still expects one runtime blob. */
export type SequenceRuntimeState = {
  recordingMode: EventSequenceRecordingMode;
  activeIndex: number;
  pendingStepId: string | null;
  replayBatchSession: ReplayBatchSessionState | null;
  replayJourney: ReplayJourneyState;
  replayDiagnostics: ReplayDiagnosticsState;
};

export const EMPTY_REPLAY_JOURNEY: ReplayJourneyState = {
  active: false,
  currentStep: 0,
  totalSteps: 0,
  lastCompletedAt: null,
};

export const EMPTY_REPLAY_DIAGNOSTICS: ReplayDiagnosticsState = {
  activeSignature: null,
  activeStepId: null,
  totalSteps: 0,
  startedAt: null,
  completedAt: null,
  stepStates: {},
};

export const EMPTY_SEQUENCE_RUNTIME_STATE: SequenceRuntimeState = {
  recordingMode: "idle",
  activeIndex: 0,
  pendingStepId: null,
  replayBatchSession: null,
  replayJourney: EMPTY_REPLAY_JOURNEY,
  replayDiagnostics: EMPTY_REPLAY_DIAGNOSTICS,
};

/**
 * Storage-slot address for per-scenario event-sequence state.
 *
 * Zustand stores (sequence replay, batch, recording, game progress, capture)
 * keep a map keyed by this string so switching scenarios preserves each
 * scenario's state without collision. `scenarioId` alone isn't safe because
 * scenario IDs are level-scoped (e.g. "intro" can exist in level 3 and 5).
 *
 * There is no `creator` vs `game` dimension in the key — creator and game
 * run in separate Next.js routes with separate provider trees.
 */
export function getEventSequenceScenarioUiKey(levelId: number, scenarioId: string): string {
  return `${levelId}:${scenarioId}`;
}
