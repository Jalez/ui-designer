"use client";

/**
 * LevelContext — level-scoped facts for the currently active level.
 *
 * Subservient to GameContext. Owns "which level are we on + what's true for
 * the whole level":
 *   currentLevel, level data, scenarios, showHotkeys, drawboardCaptureMode,
 *   levelAccuracy (aggregate over its scenarios).
 *
 * Hierarchy + flow: GameContext -> LevelContext -> ScenarioContext.
 *
 * Nested above ScenarioProvider.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  EMPTY_LEVEL_ACCURACY_AGGREGATE,
  type LevelAccuracyAggregate,
  type ScenarioAccuracyEntry,
} from "@/events/core/aggregateLevelAccuracy";
import { useGameContext } from "./GameContext";
import type { scenario } from "@/types";
import type { RootState } from "@/store/store";

const EMPTY_SCENARIOS: scenario[] = [];

type LevelContextValue = {
  currentLevel: number;
  level: RootState["levels"][number] | undefined;
  scenarios: scenario[];
  showHotkeys: boolean;
  levelAccuracy: LevelAccuracyAggregate;
  scenarioAccuraciesById: Record<string, ScenarioAccuracyEntry>;
};

const LevelContext = createContext<LevelContextValue | null>(null);

export function LevelProvider({ children }: { children: ReactNode }) {
  const {
    currentLevel,
    currentLevelIndex,
    levelAccuracies,
  } = useGameContext();

  const scenarios = currentLevel?.scenarios ?? EMPTY_SCENARIOS;
  const showHotkeys = currentLevel?.showHotkeys ?? false;
  const levelAccuracy = levelAccuracies[currentLevelIndex - 1] ?? EMPTY_LEVEL_ACCURACY_AGGREGATE;

  const scenarioAccuraciesById = useMemo(() => {
    const out: Record<string, ScenarioAccuracyEntry> = {};
    levelAccuracy.scenarios.forEach((s) => { out[s.scenarioId] = s; });
    return out;
  }, [levelAccuracy]);

  const value = useMemo<LevelContextValue>(() => ({
    currentLevel: currentLevelIndex,
    level: currentLevel,
    scenarios,
    showHotkeys,
    levelAccuracy,
    scenarioAccuraciesById,
  }), [
    currentLevel,
    currentLevelIndex,
    levelAccuracy,
    scenarioAccuraciesById,
    scenarios,
    showHotkeys,
  ]);

  return <LevelContext.Provider value={value}>{children}</LevelContext.Provider>;
}

export function useLevelContext(): LevelContextValue {
  const ctx = useContext(LevelContext);
  if (!ctx) {
    throw new Error("useLevelContext must be used within LevelProvider");
  }
  return ctx;
}
