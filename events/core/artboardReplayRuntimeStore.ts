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

export type ReplayComparisonResult = ReplayStepToken & {
  accuracy: number;
  comparedAt: number;
  diff: string | null;
  drawingFingerprint: string;
  solutionFingerprint: string;
};

type BoardFreshnessByStep = Record<string, BoardStepFreshness>;
type FreshnessByBoard = Record<ReplayArtboardKind, BoardFreshnessByStep>;

type ArtboardReplayRuntimeState = {
  freshnessByKey: Record<string, FreshnessByBoard>;
  resultsByKey: Record<string, Record<string, ReplayComparisonResult>>;

  setBoardStepFreshness: (
    key: string,
    board: ReplayArtboardKind,
    stepId: string,
    updater: (current: BoardStepFreshness) => BoardStepFreshness,
  ) => void;
  setReplayComparisonResult: (key: string, result: ReplayComparisonResult) => void;
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

export const useArtboardReplayRuntimeStore = create<ArtboardReplayRuntimeState>((set) => ({
  freshnessByKey: {},
  resultsByKey: {},

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
}));

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
