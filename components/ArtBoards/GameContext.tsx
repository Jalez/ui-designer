"use client";

/**
 * GameContext — top-level game state.
 *
 * Owns: all levels of the game, the index of the level the user is viewing,
 * the aggregated accuracy of every level (and its scenarios), total game
 * points, capture-mode + creator-context flags.
 *
 * The redux points slice is driven from here: whenever a scenario's aggregate
 * becomes `meanKnown && !stale`, this provider dispatches it. Footer/level
 * views are pure display — they do NOT dispatch.
 *
 * Mount order: GameProvider > LevelProvider > ScenarioProvider > EventProvider.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { setCurrentLevel as setCurrentLevelAction } from "@/store/slices/currentLevel.slice";
import { updateLevelAccuracyByIndexThunk } from "@/store/actions/score.actions";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";
import { useGameStore } from "@/components/default/games";
import {
  aggregateLevelAccuracy,
  EMPTY_LEVEL_ACCURACY_AGGREGATE,
  type LevelAccuracyAggregate,
} from "@/events/core/aggregateLevelAccuracy";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceAccuracyStore";
import type { Level } from "@/types";

type GameContextValue = {
  levels: Level[];
  currentLevelIndex: number;
  currentLevel: Level | undefined;
  setCurrentLevelIndex: (next: number) => void;
  /** Route mode only (`/creator/...`). Not a permission flag. */
  isCreatorRoute: boolean;
  /** Permission: current user can edit the current game. */
  canEditCurrentGame: boolean;
  /** Permission: current user owns the current game. */
  isGameOwner: boolean;
  showLive: boolean;
  setshowLiveForCurrentRoute: (interactive: boolean) => void;
  levelAccuracies: LevelAccuracyAggregate[];
  gamePoints: { allPoints: number; allMaxPoints: number };
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const levels = useAppSelector((state) => state.levels);
  const currentLevelIndex = useAppSelector((state) => state.currentLevel.currentLevel);
  const gamePoints = useAppSelector((state) => ({
    allPoints: state.points.allPoints,
    allMaxPoints: state.points.allMaxPoints,
  }));
  const captureByKey = useEventSequenceCaptureStore((s) => s.captureByKey);
  const isCreatorRoute = useIsCreatorRoute();

  //TODO: This should be faster by using the gameId from the url params instead of the store. We should be getting the game details when we load the route
  const currentGame = useGameStore((state) => {
    if (!state.currentGameId) {
      return null;
    }
    return state.games.find((candidate) => candidate.id === state.currentGameId) ?? null;
  });
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
  const isGameOwner = Boolean(currentGame?.isOwner);
  const [showLive, setshowLive] = useState<boolean>(isCreatorRoute);

  const levelAccuracies = useMemo(
    () => levels.map((level, idx) => aggregateLevelAccuracy(idx + 1, level, captureByKey)),
    [levels, captureByKey],
  );

  const lastDispatchedRef = useRef<Record<string, string>>({});

  useEffect(() => {
    levelAccuracies.forEach((la, levelIdx) => {
      la.scenarios.forEach((s) => {
        if (!s.meanKnown || s.stale) return;
        const dispatchKey = `${levelIdx}:${s.scenarioId}`;
        const sig = `${s.accuracy}`;
        if (lastDispatchedRef.current[dispatchKey] === sig) return;
        lastDispatchedRef.current[dispatchKey] = sig;
        dispatch(
          updateLevelAccuracyByIndexThunk(levelIdx, s.scenarioId, s.accuracy, true),
        );
      });
    });
  }, [levelAccuracies, dispatch]);

  const setCurrentLevelIndex = useMemo(
    () => (next: number) => { dispatch(setCurrentLevelAction(next)); },
    [dispatch],
  );
  const setshowLiveForCurrentRoute = useCallback((interactive: boolean) => {
    setshowLive(interactive);
  }, []);

  const currentLevel = levels[currentLevelIndex - 1];

  const value = useMemo<GameContextValue>(() => ({
    levels,
    currentLevelIndex,
    currentLevel,
    setCurrentLevelIndex,
    isCreatorRoute,
    canEditCurrentGame,
    isGameOwner,
    showLive,
    setshowLiveForCurrentRoute,
    levelAccuracies,
    gamePoints,
  }), [
    currentLevel,
    currentLevelIndex,
    gamePoints,
    isCreatorRoute,
    canEditCurrentGame,
    isGameOwner,
    levelAccuracies,
    levels,
    showLive,
    setshowLiveForCurrentRoute,
    setCurrentLevelIndex,
  ]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used within GameProvider");
  return ctx;
}

export function useLevelAccuracyAt(levelIndex: number): LevelAccuracyAggregate {
  const { levelAccuracies } = useGameContext();
  return levelAccuracies[levelIndex - 1] ?? EMPTY_LEVEL_ACCURACY_AGGREGATE;
}
