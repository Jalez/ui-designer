'use client';

//Add a button component that is used to remove the current level.

import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { removeLevel } from "@/store/slices/levels.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { Trash2 } from "lucide-react";
import PoppingTitle from "../General/PoppingTitle";
const LevelRemover = () => {
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
  return (
    <div className="flex flex-col justify-center items-center">
      <PoppingTitle topTitle="Remove Level">
        <Button onClick={handleRemove} variant="ghost" size="icon">
          <Trash2 className="h-5 w-5" />
        </Button>
      </PoppingTitle>
    </div>
  );
};

export default LevelRemover;
