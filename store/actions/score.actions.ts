/** @format */

import { scoreTypes } from "@/store/constants/score.actions";
import { addNotificationData } from "../slices/notifications.slice";
import { updatePoints } from "../slices/score.slice";
import { AppThunk } from "../store";
import { Level } from "@/types";

export const updateMaxPoints = (maxPoints = 0) => {
  return {
    type: scoreTypes.updateMaxPoints,
    payload: maxPoints,
  };
};

export const updatePointsThunk =
  (accuracy: number): AppThunk =>
  async (dispatch, getState) => {
    {
      const levels = getState().levels;
      const updatedPoints = levels.reduce((acc, level) => {
        acc += level.points;
        return acc;
      }, 0);

      dispatch(updatePoints(updatedPoints));
      dispatch(sendScoreToParentFrame());
    }
  };

export const updateLevelAccuracyThunk =
  (level: Level, scenarioId: string, accuracy: number): AppThunk =>
  async (dispatch, getState) => {
    const { updateLevelAccuracy, refreshPoints } = await import("../slices/points.slice");
    const { updateLevelPoints } = await import("../slices/levels.slice");

    // Update the points slice
    dispatch(updateLevelAccuracy({ level, scenarioId, accuracy }));

    // Get the updated points for this level from the points slice
    const pointsState = getState().points;
    const levelPoints = pointsState.levels[level.name]?.points || 0;

    // Find the level index in the levels array
    const levels = getState().levels;
    const levelIndex = levels.findIndex(l => l.name === level.name);
    if (levelIndex !== -1) {
      // Update the level's points in the levels slice
      dispatch(updateLevelPoints({ levelId: levelIndex + 1, points: levelPoints }));
    }

    // Refresh total points
    dispatch(refreshPoints());
  };

export const initializePointsFromLevelsStateThunk = (): AppThunk => async (dispatch, getState) => {
  const { initializePoints } = await import("../slices/points.slice");
  const levels = getState().levels;
  dispatch(initializePoints(levels));
};

export const sendScoreToParentFrame = (): AppThunk => (dispatch, getState) => {
  const levels = getState().levels;
  const points = getState().points;
  if (levels.length === 0) return;
  const allPoints = points.allPoints;
  const maxPoints = points.allMaxPoints;

  // get the best time and points for each level from points
  let levelsWithPoints = 0;
  let levelsWithZeroPoints = 0;
  const bestTimes = {} as Record<string, [string, number]>;
  for (const level of levels) {
    const title = level.name;
    if (!points.levels[level.name]) {
      continue;
    }
    const bestPoints = points.levels[level.name].points;
    if (bestPoints === 0) {
      levelsWithZeroPoints++;
    } else {
      levelsWithPoints++;
    }
    const bestTime = points.levels[level.name].bestTime;
    bestTimes[title] = [bestTime, bestPoints];
  }

  const urlParams = new URLSearchParams(window.location.search);
  const map = urlParams.get("map") || "all";

  const bestTimesString = JSON.stringify(bestTimes);
  const data = allPoints + ";" + maxPoints + ";" + map + ";" + bestTimesString;
  const encryptedData = btoa(data);
  window.parent.postMessage(
    {
      m: "s",
      d: encryptedData,
    },
    "*"
  );

  const levelsAndCode = {} as Record<string, {}>;
  // go through all levels and get the code, also tell the parent frame if the code is locked
  for (const level of levels) {
    const title = level.name;
    levelsAndCode[title] = {
      code: level.code,
      lockCSS: level.lockCSS,
      lockHTML: level.lockHTML,
      lockJS: level.lockJS,
    };
  }

  window.parent.postMessage(
    {
      m: "c",
      d: JSON.stringify(levelsAndCode),
    },
    "*"
  );
  if (levelsWithPoints === 0) {
    dispatch(
      addNotificationData({
        message:
          "Score " +
          allPoints +
          " / " +
          maxPoints +
          " saved. No levels were reported as completed.",
        type: "error",
      })
    );
    return;
  }
  if (levelsWithZeroPoints === 0) {
    dispatch(
      addNotificationData({
        message:
          "Score " +
          allPoints +
          " / " +
          maxPoints +
          " saved. You have completed all levels. Remember to submit your work!",
        type: "success",
      })
    );
    return;
  }
  dispatch(
    addNotificationData({
      message:
        "Score " +
        allPoints +
        " / " +
        maxPoints +
        " saved. You have completed " +
        levelsWithPoints +
        " levels and have " +
        levelsWithZeroPoints +
        " levels with 0 points.",
      type: "info",
    })
  );
};
