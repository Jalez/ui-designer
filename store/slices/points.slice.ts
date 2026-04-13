import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Level, levelNames, scenarioAccuracy } from "@/types";
import { numberTimeToMinutesAndSeconds } from "@/lib/utils/numberTimeToMinutesAndSeconds";

type LevelPoints = {
  [K in levelNames]: {
    points: number;
    maxPoints: number;
    accuracy: number;
    /** False when any scenario lacks a computable mean (e.g. event-sequence aggregate incomplete). */
    meanAccuracyKnown?: boolean;
    bestTime: string;
    scenarios: scenarioAccuracy[];
  };
};

type Points = {
  allPoints: number;
  allMaxPoints: number;
  levels: LevelPoints;
};

function getAverageScenarioAccuracy(level: Level, existingScenarios?: scenarioAccuracy[]): number {
  const scenarios = existingScenarios ?? level.scenarios.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    accuracy: scenario.accuracy,
  }));

  if (scenarios.length === 0) {
    return Number(level.accuracy || 0);
  }

  const percentage = scenarios.reduce((acc, scenario) => acc + scenario.accuracy, 0) / scenarios.length;
  return Math.round(percentage * 100) / 100;
}

function levelScenariosAllMeansKnown(scenarios: scenarioAccuracy[]): boolean {
  return scenarios.every((s) => s.meanAccuracyKnown !== false);
}

function computeLevelPointsAccuracyFields(
  level: Level,
  scenarios: scenarioAccuracy[],
): { accuracy: number; meanAccuracyKnown: boolean } {
  if (!levelScenariosAllMeansKnown(scenarios)) {
    return { accuracy: 0, meanAccuracyKnown: false };
  }
  return {
    accuracy: getAverageScenarioAccuracy(level, scenarios),
    meanAccuracyKnown: true,
  };
}

function calculatePointsFromThresholds(level: Level, accuracy: number): number {
  const sorted = [...level.pointsThresholds].sort((a, b) => a.accuracy - b.accuracy);
  let earnedPercent = 0;
  for (const threshold of sorted) {
    if (accuracy >= threshold.accuracy) {
      earnedPercent = threshold.pointsPercent;
    }
  }
  return Math.ceil((earnedPercent / 100) * level.maxPoints);
}

function buildLevelPoints(level: Level) {
  const scenarios = level.scenarios.map((scenario) => ({
    scenarioId: scenario.scenarioId,
    accuracy: scenario.accuracy,
  }));
  const { accuracy, meanAccuracyKnown } = computeLevelPointsAccuracyFields(level, scenarios);

  return {
    points: calculatePointsFromThresholds(level, accuracy),
    maxPoints: level.maxPoints,
    accuracy,
    meanAccuracyKnown,
    bestTime: "0:0",
    scenarios,
  };
}

const initialState: Points = {
  allPoints: 0,
  allMaxPoints: 0,
  levels: {},
} as Points;

export const pointsSlice = createSlice({
  name: "points",
  initialState,
  reducers: {
    initializePoints: (state, action: PayloadAction<Level[]>) => {
      // Initialize points from levels (used during app startup)
      const levels = action.payload;

      state.allPoints = levels.reduce(
        (acc, level) => acc + calculatePointsFromThresholds(level, getAverageScenarioAccuracy(level)),
        0
      );
      state.allMaxPoints = levels.reduce(
        (acc, level) => acc + level.maxPoints,
        0
      );
      levels.forEach((level) => {
        state.levels[level.name] = buildLevelPoints(level);
      });
    },
    refreshPoints: (state) => {
      //go through the levels and their points, add them together and update allPoints
      state.allPoints = Object.values(state.levels).reduce(
        (acc, level) => acc + level.points,
        0
      );
    },
    updateMaxPoints: (state, action: PayloadAction<Level[]>) => {
      state.allMaxPoints = action.payload.reduce(
        (acc, level) => acc + level.maxPoints,
        0
      );
    },
    updateLevelPoints: (
      state,
      action: PayloadAction<{ level: Level; points: number }>
    ) => {
      state.levels[action.payload.level.name].points = action.payload.points;
    },
    updateLevelMaxPoints: (
      state,
      action: PayloadAction<{ level: Level; maxPoints: number }>
    ) => {
      state.levels[action.payload.level.name].maxPoints =
        action.payload.maxPoints;
    },
    updateLevelBestTime: (
      state,
      action: PayloadAction<{ level: Level; bestTime: string }>
    ) => {
      state.levels[action.payload.level.name].bestTime =
        action.payload.bestTime;
    },
    updateLevelAccuracy: (
      state,
      action: PayloadAction<{
        level: Level;
        scenarioId: string;
        accuracy: number;
        meanAccuracyKnown?: boolean;
      }>
    ) => {
      const levelName = action.payload.level.name;
      const scenarioId = action.payload.scenarioId;
      const startTime = action.payload.level.timeData.startTime;
      let level = state.levels[levelName];
      if (!level) {
        level = buildLevelPoints(action.payload.level);
        state.levels[levelName] = level;
      }
      let scenario = level.scenarios.find(
        (scenario) => scenario.scenarioId === scenarioId
      );

      if (!scenario) {
        // Scenario was added after points were initialized – insert it now
        level.scenarios.push({ scenarioId, accuracy: 0, meanAccuracyKnown: true });
        scenario = level.scenarios[level.scenarios.length - 1];
      }
      scenario.accuracy = action.payload.accuracy;
      scenario.meanAccuracyKnown = action.payload.meanAccuracyKnown ?? true;

      const { accuracy: percentage, meanAccuracyKnown } = computeLevelPointsAccuracyFields(
        action.payload.level,
        level.scenarios,
      );
      level.accuracy = percentage;
      level.meanAccuracyKnown = meanAccuracyKnown;
      level.maxPoints = action.payload.level.maxPoints;
      const newpoints = calculatePointsFromThresholds(action.payload.level, level.accuracy);
      if (newpoints <= level.points) return;
      level.points = newpoints;
      const currentTime = new Date().getTime();
      level.bestTime = numberTimeToMinutesAndSeconds(currentTime - startTime);
    },
    recalculateLevelPoints: (state, action: PayloadAction<{ level: Level }>) => {
      const { level } = action.payload;
      const existing = state.levels[level.name];
      const scenarios = existing?.scenarios?.length
        ? existing.scenarios
        : level.scenarios.map((scenario) => ({
            scenarioId: scenario.scenarioId,
            accuracy: scenario.accuracy,
          }));
      const { accuracy, meanAccuracyKnown } = computeLevelPointsAccuracyFields(level, scenarios);
      const nextPoints = calculatePointsFromThresholds(level, accuracy);

      state.levels[level.name] = {
        points: nextPoints,
        maxPoints: level.maxPoints,
        accuracy,
        meanAccuracyKnown,
        bestTime: existing?.bestTime ?? "0:0",
        scenarios,
      };
      state.allPoints = Object.values(state.levels).reduce((acc, item) => acc + item.points, 0);
      state.allMaxPoints = Object.values(state.levels).reduce((acc, item) => acc + item.maxPoints, 0);
    },
    renameLevelKey: (state, action: PayloadAction<{ oldName: string; newName: string }>) => {
      const { oldName, newName } = action.payload;
      if (state.levels[oldName]) {
        state.levels[newName] = state.levels[oldName];
        delete state.levels[oldName];
      }
    },
    /** Merge saved per-level points from backend (e.g. game instance progressData.pointsByLevel). */
    mergeSavedPoints: (
      state,
      action: PayloadAction<
        Record<
          string,
          {
            points?: number;
            maxPoints?: number;
            accuracy?: number;
            bestTime?: string;
            scenarios?: { scenarioId: string; accuracy: number; meanAccuracyKnown?: boolean }[];
          }
        >
      >,
    ) => {
      const saved = action.payload;
      if (!saved || typeof saved !== "object") return;
      for (const levelName of Object.keys(state.levels)) {
        const data = saved[levelName];
        if (!data) continue;
        const level = state.levels[levelName];
        if (typeof data.points === "number" && data.points >= 0) level.points = data.points;
        if (typeof data.maxPoints === "number") level.maxPoints = data.maxPoints;
        if (typeof data.accuracy === "number") level.accuracy = data.accuracy;
        if (typeof data.bestTime === "string") level.bestTime = data.bestTime;
        if (Array.isArray(data.scenarios)) {
          level.scenarios = data.scenarios.map((s) => ({
            scenarioId: s.scenarioId,
            accuracy: s.accuracy,
            meanAccuracyKnown: s.meanAccuracyKnown,
          }));
          if (!level.scenarios.every((s) => s.meanAccuracyKnown !== false)) {
            level.meanAccuracyKnown = false;
            level.accuracy = 0;
          } else {
            level.meanAccuracyKnown = true;
          }
        }
      }
      state.allPoints = Object.values(state.levels).reduce((acc, l) => acc + l.points, 0);
    },
  },
});

export const {
  initializePoints,
  refreshPoints,
  updateMaxPoints,
  updateLevelPoints,
  updateLevelMaxPoints,
  updateLevelBestTime,
  updateLevelAccuracy,
  recalculateLevelPoints,
  renameLevelKey,
  mergeSavedPoints,
} = pointsSlice.actions;

export default pointsSlice.reducer;
// Path: src/store/slices/score.slice.ts
