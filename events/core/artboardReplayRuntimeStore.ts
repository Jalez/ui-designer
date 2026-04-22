"use client";

import { create } from "zustand";

export type ReplayArtboardKind = "drawing" | "solution";
export type ReplayTerminalStatus = "completed" | "cancelled" | "failed";

export type ReplayStepToken = {
  runId: number;
  stepId: string;
};

export type BoardStepFreshness = {
  imageUrl: string | null;
  fingerprint: string | null;
  capturedAt: number | null;
  isReady: boolean;
  isStale: boolean;
  lastRunId: number | null;
};

export type ReplayBoardCapture = ReplayStepToken & {
  board: ReplayArtboardKind;
  capturedAt: number;
  fingerprint: string;
  imageData?: ImageData;
  imageUrl: string;
};

export type ReplayStepPair = ReplayStepToken & {
  comparedAt?: number;
  drawing?: ReplayBoardCapture;
  solution?: ReplayBoardCapture;
};

export type ReplayComparisonResult = ReplayStepToken & {
  accuracy: number;
  comparedAt: number;
  diff: string | null;
  drawingFingerprint: string;
  solutionFingerprint: string;
};

export type ReplayDisplayState = {
  activeRunId: number | null;
  activeStepId: string | null;
  restoreStepId: string | null;
};

type ReplayRunStatusState = {
  runId: number;
  boardStatus: Partial<Record<ReplayArtboardKind, ReplayTerminalStatus | "started">>;
};

type BoardFreshnessByStep = Record<string, BoardStepFreshness>;
type FreshnessByBoard = Record<ReplayArtboardKind, BoardFreshnessByStep>;

type ArtboardReplayRuntimeState = {
  displayByKey: Record<string, ReplayDisplayState>;
  freshnessByKey: Record<string, FreshnessByBoard>;
  pairsByKey: Record<string, Record<string, ReplayStepPair>>;
  resultsByKey: Record<string, Record<string, ReplayComparisonResult>>;
  statusByKey: Record<string, ReplayRunStatusState | null>;

  startRun: (key: string, runId: number, restoreStepId: string | null, initialStepId: string | null) => void;
  finishReplayRun: (key: string, runId: number) => void;
  clearRun: (key: string, runId: number) => void;
  setActiveReplayDisplayStep: (key: string, runId: number, stepId: string | null) => void;
  setBoardStepFreshness: (
    key: string,
    board: ReplayArtboardKind,
    stepId: string,
    updater: (current: BoardStepFreshness) => BoardStepFreshness,
  ) => void;
  registerBoardCapture: (key: string, capture: ReplayBoardCapture) => void;
  setReplayComparisonResult: (key: string, result: ReplayComparisonResult) => void;
  registerBoardStatus: (
    key: string,
    runId: number,
    board: ReplayArtboardKind,
    status: ReplayTerminalStatus | "started",
  ) => boolean;
};

const EMPTY_FRESHNESS: BoardStepFreshness = {
  imageUrl: null,
  fingerprint: null,
  capturedAt: null,
  isReady: false,
  isStale: false,
  lastRunId: null,
};

function getPairKey(runId: number, stepId: string): string {
  return `${runId}:${stepId}`;
}

function getFreshnessByBoard(
  state: ArtboardReplayRuntimeState,
  key: string,
): FreshnessByBoard {
  return state.freshnessByKey[key] ?? { drawing: {}, solution: {} };
}

export const useArtboardReplayRuntimeStore = create<ArtboardReplayRuntimeState>((set, get) => ({
  displayByKey: {},
  freshnessByKey: {},
  pairsByKey: {},
  resultsByKey: {},
  statusByKey: {},

  startRun: (key, runId, restoreStepId, initialStepId) => {
    set((state) => ({
      displayByKey: {
        ...state.displayByKey,
        [key]: {
          activeRunId: runId,
          activeStepId: initialStepId,
          restoreStepId,
        },
      },
      statusByKey: {
        ...state.statusByKey,
        [key]: {
          runId,
          boardStatus: {},
        },
      },
    }));
  },

  finishReplayRun: (key, runId) => {
    set((state) => {
      const current = state.displayByKey[key];
      if (!current || current.activeRunId !== runId) {
        return state;
      }
      return {
        displayByKey: {
          ...state.displayByKey,
          [key]: {
            activeRunId: null,
            activeStepId: null,
            restoreStepId: current.restoreStepId,
          },
        },
        statusByKey: {
          ...state.statusByKey,
          [key]: null,
        },
      };
    });
  },

  clearRun: (key, runId) => {
    set((state) => {
      const nextPairs: Record<string, ReplayStepPair> = {};
      for (const [pairKey, pair] of Object.entries(state.pairsByKey[key] ?? {})) {
        if (pair.runId !== runId) {
          nextPairs[pairKey] = pair;
        }
      }
      return {
        pairsByKey: {
          ...state.pairsByKey,
          [key]: nextPairs,
        },
      };
    });
  },

  setActiveReplayDisplayStep: (key, runId, stepId) => {
    set((state) => {
      const current = state.displayByKey[key];
      if (!current || current.activeRunId !== runId || current.activeStepId === stepId) {
        return state;
      }
      return {
        displayByKey: {
          ...state.displayByKey,
          [key]: { ...current, activeStepId: stepId },
        },
      };
    });
  },

  setBoardStepFreshness: (key, board, stepId, updater) => {
    set((state) => {
      const freshnessByBoard = getFreshnessByBoard(state, key);
      const boardFreshness = freshnessByBoard[board];
      const current = boardFreshness[stepId] ?? EMPTY_FRESHNESS;
      const next = updater(current);
      if (
        next.imageUrl === current.imageUrl
        && next.fingerprint === current.fingerprint
        && next.capturedAt === current.capturedAt
        && next.isReady === current.isReady
        && next.isStale === current.isStale
        && next.lastRunId === current.lastRunId
      ) {
        return state;
      }
      return {
        freshnessByKey: {
          ...state.freshnessByKey,
          [key]: {
            ...freshnessByBoard,
            [board]: {
              ...boardFreshness,
              [stepId]: next,
            },
          },
        },
      };
    });
  },

  registerBoardCapture: (key, capture) => {
    set((state) => {
      const pairKey = getPairKey(capture.runId, capture.stepId);
      const currentPairs = state.pairsByKey[key] ?? {};
      const currentPair = currentPairs[pairKey] ?? { runId: capture.runId, stepId: capture.stepId };
      return {
        pairsByKey: {
          ...state.pairsByKey,
          [key]: {
            ...currentPairs,
            [pairKey]: {
              ...currentPair,
              [capture.board]: capture,
            },
          },
        },
      };
    });
  },

  setReplayComparisonResult: (key, result) => {
    set((state) => ({
      resultsByKey: {
        ...state.resultsByKey,
        [key]: {
          ...(state.resultsByKey[key] ?? {}),
          [getPairKey(result.runId, result.stepId)]: result,
        },
      },
    }));
  },

  registerBoardStatus: (key, runId, board, status) => {
    const currentStatus = get().statusByKey[key];
    if (!currentStatus || currentStatus.runId !== runId) {
      set((state) => ({
        statusByKey: {
          ...state.statusByKey,
          [key]: {
            runId,
            boardStatus: {
              [board]: status,
            },
          },
        },
      }));
      return false;
    }

    const nextBoardStatus = {
      ...currentStatus.boardStatus,
      [board]: status,
    };
    set((state) => ({
      statusByKey: {
        ...state.statusByKey,
        [key]: {
          runId,
          boardStatus: nextBoardStatus,
        },
      },
    }));

    const drawingStatus = nextBoardStatus.drawing;
    const solutionStatus = nextBoardStatus.solution;
    const drawingTerminal = drawingStatus === "completed" || drawingStatus === "cancelled" || drawingStatus === "failed";
    const solutionTerminal = solutionStatus === "completed" || solutionStatus === "cancelled" || solutionStatus === "failed";
    return drawingTerminal && solutionTerminal;
  },
}));

export function selectReplayDisplayState(
  displayByKey: Record<string, ReplayDisplayState>,
  key: string | null | undefined,
): ReplayDisplayState {
  return key ? displayByKey[key] ?? { activeRunId: null, activeStepId: null, restoreStepId: null } : {
    activeRunId: null,
    activeStepId: null,
    restoreStepId: null,
  };
}

export function selectBoardFreshnessMap(
  freshnessByKey: Record<string, FreshnessByBoard>,
  key: string | null | undefined,
  board: ReplayArtboardKind,
): BoardFreshnessByStep {
  if (!key) {
    return {};
  }
  return freshnessByKey[key]?.[board] ?? {};
}

export function getBoardStepFreshness(
  key: string,
  board: ReplayArtboardKind,
  stepId: string,
): BoardStepFreshness {
  return selectBoardFreshnessMap(useArtboardReplayRuntimeStore.getState().freshnessByKey, key, board)[stepId] ?? EMPTY_FRESHNESS;
}

export function getReplayComparisonResult(
  key: string,
  runId: number,
  stepId: string,
): ReplayComparisonResult | null {
  return useArtboardReplayRuntimeStore.getState().resultsByKey[key]?.[getPairKey(runId, stepId)] ?? null;
}

export function getUsableReplayComparisonResult(
  key: string,
  runId: number,
  stepId: string,
  drawingFingerprint: string | null | undefined,
  solutionFingerprint: string | null | undefined,
): ReplayComparisonResult | null {
  const result = getReplayComparisonResult(key, runId, stepId);
  if (!result) {
    return null;
  }
  if (
    result.drawingFingerprint !== (drawingFingerprint ?? null)
    || result.solutionFingerprint !== (solutionFingerprint ?? null)
  ) {
    return null;
  }
  return result;
}

export function getLatestReplayComparisonResultForStep(
  key: string,
  stepId: string,
): ReplayComparisonResult | null {
  const results = Object.values(useArtboardReplayRuntimeStore.getState().resultsByKey[key] ?? {})
    .filter((result) => result.stepId === stepId)
    .sort((left, right) => right.comparedAt - left.comparedAt);
  return results[0] ?? null;
}

export function getLatestUsableReplayComparisonResultForStep(
  key: string,
  stepId: string,
  drawingFingerprint: string | null | undefined,
  solutionFingerprint: string | null | undefined,
): ReplayComparisonResult | null {
  const results = Object.values(useArtboardReplayRuntimeStore.getState().resultsByKey[key] ?? {})
    .filter((result) => (
      result.stepId === stepId
      && result.drawingFingerprint === (drawingFingerprint ?? null)
      && result.solutionFingerprint === (solutionFingerprint ?? null)
    ))
    .sort((left, right) => right.comparedAt - left.comparedAt);
  return results[0] ?? null;
}

export function selectReplayResultsForKey(
  resultsByKey: Record<string, Record<string, ReplayComparisonResult>>,
  key: string | null | undefined,
): Record<string, ReplayComparisonResult> {
  return key ? resultsByKey[key] ?? {} : {};
}

export function isArtboardReplayDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem("artboardReplayDebug") === "1"
      || (window as Window & { __ARTBOARD_REPLAY_DEBUG__?: boolean }).__ARTBOARD_REPLAY_DEBUG__ === true;
  } catch {
    return false;
  }
}

export function logArtboardReplayDebug(event: string, payload: unknown): void {
  if (!isArtboardReplayDebugEnabled()) {
    return;
  }
  console.debug(`[artboardReplay] ${event}`, payload);
}
