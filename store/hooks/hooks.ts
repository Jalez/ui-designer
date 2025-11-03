/** @format */

import { useCallback } from "react";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
// import { updateEvaluationUrl } from "../slices/levels.slice";
import { AppDispatch, RootState } from "../store";

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const useScreenshotUpdate = (scenarioId: string) => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const dispatch = useAppDispatch();

  const updateScreenshot = useCallback(
    (screenshotName: string, dataUrl: string) => {
      // dispatch(
      //   updateEvaluationUrl({
      //     dataUrl,
      //     id: currentLevel,
      //     name: screenshotName,
      //     scenarioId,
      //   })
      // );
    },
    [currentLevel, dispatch, scenarioId]
  );

  return { updateScreenshot };
};
