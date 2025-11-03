import { PayloadAction, createSlice } from "@reduxjs/toolkit";
import { Level, levelNames, scenarioAccuracy } from "@/types";
import { numberTimeToMinutesAndSeconds } from "@/lib/utils/numberTimeToMinutesAndSeconds";

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
      state.allPoints = action.payload.reduce(
        (acc, level) => acc + level.points,
        0
      );
      state.allMaxPoints = action.payload.reduce(
        (acc, level) => acc + level.maxPoints,
        0
      );
      action.payload.forEach((level) => {
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
      }>
    ) => {
      const levelName = action.payload.level.name;
      const percentageTreshold = action.payload.level?.percentageTreshold || 90; // Default to 90 if not defined
      const scenarioId = action.payload.scenarioId;
      const startTime = action.payload.level.timeData.startTime;
      const level = state.levels[levelName];
      if (!level) {
        console.error("Level not found");
        return;
      }
      const scenario = level.scenarios.find(
        (scenario) => scenario.scenarioId === scenarioId
      );

      if (!scenario) {
        console.error(
          "Scenario not found",
          level.scenarios[0].accuracy,
          level.scenarios[1].accuracy
        );
        return;
      }
      scenario.accuracy = action.payload.accuracy;

      // Also update the level accuracy by summing up all scenario accuracies and dividing by the number of scenarios
      const levelScenarios = level.scenarios;
      const levelAccuracies = levelScenarios.map((scenario) => ({
        accuracy: scenario.accuracy,
      }));
      const levelAccuracySummed = levelAccuracies.reduce(
        (acc, scenario) => acc + scenario.accuracy,
        0
      );

      const percentage = levelAccuracySummed / level.scenarios.length;
      const roundedPercentage = Math.round(percentage * 100) / 100;
      level.accuracy = roundedPercentage;

      let newpoints = 0;
      if (percentage > percentageTreshold) {
        const lastTenPercent = percentage - percentageTreshold;
        const remainingPercentage = 100 - percentageTreshold;
        const lastTenPercentPercentage = lastTenPercent / remainingPercentage;
        newpoints = Math.ceil(lastTenPercentPercentage * level.maxPoints);
        if (newpoints < level.points) return;
        level.points = newpoints;
        const currentTime = new Date().getTime();
        level.bestTime = numberTimeToMinutesAndSeconds(currentTime - startTime);
      }
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
} = pointsSlice.actions;

export default pointsSlice.reducer;
// Path: src/store/slices/score.slice.ts
