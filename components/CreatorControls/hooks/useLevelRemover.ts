'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { removeLevel } from "@/store/slices/levels.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";

export const useLevelRemover = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();

  const handleRemove = () => {
    //consider the number of levels
    if (levels.length === 1) {
      console.log("Cannot remove the last level at this time");
      return;
    }
    if (currentLevel === 1) {
      dispatch(removeLevel(currentLevel));
      return;
    }
    if (currentLevel === levels.length) {
      const oldLevel = currentLevel;
      dispatch(setCurrentLevel(currentLevel - 1));
      dispatch(removeLevel(oldLevel));
      return;
    }
    dispatch(removeLevel(currentLevel));
  };

  return { handleRemove };
};


