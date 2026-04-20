"use client";

/**
 * LevelContext — level-scoped facts for the currently active level.
 *
 * Owns "which level are we on + what's true for the whole level":
 *   currentLevel, level data, scenarios, showHotkeys, drawboardCaptureMode,
 *   isCreatorContext (derived from route).
 *
 * Nested above ScenarioProvider. Scenario selection + per-scenario UI live in
 * ScenarioContext; event-sequence runtime lives in EventContext.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";
import type { scenario } from "@/types";
import type { RootState } from "@/store/store";

const EMPTY_SCENARIOS: scenario[] = [];

type LevelContextValue = {
  currentLevel: number;
  drawboardCaptureMode: "browser" | "playwright";
  isCreatorContext: boolean;
  level: RootState["levels"][number] | undefined;
  scenarios: scenario[];
  showHotkeys: boolean;
};

const LevelContext = createContext<LevelContextValue | null>(null);

export function LevelProvider({ children }: { children: ReactNode }) {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const { drawboardCaptureMode } = useGameRuntimeConfig();
  const isCreatorContext = useIsCreatorRoute();

  const scenarios = level?.scenarios ?? EMPTY_SCENARIOS;
  const showHotkeys = level?.showHotkeys ?? false;

  const value = useMemo<LevelContextValue>(() => ({
    currentLevel,
    drawboardCaptureMode,
    isCreatorContext,
    level,
    scenarios,
    showHotkeys,
  }), [currentLevel, drawboardCaptureMode, isCreatorContext, level, scenarios, showHotkeys]);

  return <LevelContext.Provider value={value}>{children}</LevelContext.Provider>;
}

export function useLevelContext(): LevelContextValue {
  const ctx = useContext(LevelContext);
  if (!ctx) {
    throw new Error("useLevelContext must be used within LevelProvider");
  }
  return ctx;
}
