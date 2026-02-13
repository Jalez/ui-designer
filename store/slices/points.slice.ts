import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Level, levelNames, scenarioAccuracy } from "@/types";
import { numberTimeToMinutesAndSeconds } from "@/lib/utils/numberTimeToMinutesAndSeconds";
import { backendStorage } from "@/lib/utils/backendStorage";

type BasePoints = {
  allPoints: number;
  allMaxPoints: number;
};

type LevelPoints = {
  [K in levelNames]: {
    points: number;
    maxPoints: number;
    accuracy: number;
    bestTime: string;
    scenarios: scenarioAccuracy[];
  };
};

type Points = {
  allPoints: number;
  allMaxPoints: number;
  levels: LevelPoints;
};

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
        (acc, level) => acc + level.points,
        0
      );
      state.allMaxPoints = levels.reduce(
        (acc, level) => acc + level.maxPoints,
        0
      );
      levels.forEach((level) => {
        state.levels[level.name] = {
          points: level.points,
          maxPoints: level.maxPoints,
          accuracy: level?.accuracy || 0,
          bestTime: "0:0",
          scenarios: level.scenarios.map((scenario) => ({
            scenarioId: scenario.scenarioId,
            accuracy: scenario.accuracy,
          })),
        };
      });

      // Save to backend as backup
      if (typeof window !== 'undefined') {
        const pointsStorage = backendStorage('points');
        pointsStorage.setItem(pointsStorage.key, JSON.stringify(state));
      }
    },
    restorePoints: (state, action: PayloadAction<Points>) => {
      // Restore points from saved data (used in ProgressionSync)
      return action.payload;
    },
    refreshPoints: (state) => {
      //go through the levels and their points, add them together and update allPoints
      state.allPoints = Object.values(state.levels).reduce(
        (acc, level) => acc + level.points,
        0
      );

      // Save to backend as backup
      if (typeof window !== 'undefined') {
        const pointsStorage = backendStorage('points');
        pointsStorage.setItem(pointsStorage.key, JSON.stringify(state));
      }
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
      }>
    ) => {
      const levelName = action.payload.level.name;
      const scenarioId = action.payload.scenarioId;
      const startTime = action.payload.level.timeData.startTime;
      const pointsThresholds = action.payload.level.pointsThresholds;
      const level = state.levels[levelName];
      if (!level) {
        console.error("Level not found");
        return;
      }
      let scenario = level.scenarios.find(
        (scenario) => scenario.scenarioId === scenarioId
      );

      if (!scenario) {
        // Scenario was added after points were initialized – insert it now
        level.scenarios.push({ scenarioId, accuracy: 0 });
        scenario = level.scenarios[level.scenarios.length - 1];
      }
      scenario.accuracy = action.payload.accuracy;

      // Update level accuracy as average of all scenario accuracies
      const percentage =
        level.scenarios.reduce((acc, s) => acc + s.accuracy, 0) /
        level.scenarios.length;
      level.accuracy = Math.round(percentage * 100) / 100;

      let newpoints = 0;
      if (pointsThresholds && pointsThresholds.length > 0) {
        // Multi-threshold: award pointsPercent of maxPoints for the highest reached threshold
        const sorted = [...pointsThresholds].sort((a, b) => a.accuracy - b.accuracy);
        let earnedPercent = 0;
        for (const t of sorted) {
          if (percentage >= t.accuracy) earnedPercent = t.pointsPercent;
        }
        newpoints = Math.ceil((earnedPercent / 100) * level.maxPoints);
      } else {
        // Legacy single-threshold fallback
        const percentageTreshold = action.payload.level?.percentageTreshold || 90;
        if (percentage > percentageTreshold) {
          const lastTenPercent = percentage - percentageTreshold;
          const remainingPercentage = 100 - percentageTreshold;
          newpoints = Math.ceil((lastTenPercent / remainingPercentage) * level.maxPoints);
        }
      }
      if (newpoints <= level.points) return;
      level.points = newpoints;
      const currentTime = new Date().getTime();
      level.bestTime = numberTimeToMinutesAndSeconds(currentTime - startTime);
    },
    renameLevelKey: (state, action: PayloadAction<{ oldName: string; newName: string }>) => {
      const { oldName, newName } = action.payload;
      if (state.levels[oldName]) {
        state.levels[newName] = state.levels[oldName];
        delete state.levels[oldName];
      }
    },
  },
});

export const {
  initializePoints,
  restorePoints,
  refreshPoints,
  updateMaxPoints,
  updateLevelPoints,
  updateLevelMaxPoints,
  updateLevelBestTime,
  updateLevelAccuracy,
  renameLevelKey,
} = pointsSlice.actions;

export default pointsSlice.reducer;
// Path: src/store/slices/score.slice.ts
