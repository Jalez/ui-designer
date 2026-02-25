'use client';

//Add a button component that is used to create a new level.

import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addNewLevel } from "@/store/slices/levels.slice";
import PoppingTitle from "../General/PoppingTitle";
import { Plus } from "lucide-react";

const NewLevel = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const dispatch = useAppDispatch();

  const handleNewLevelCreation = () => {
    dispatch(addNewLevel());
  };
  return (
    <div className="flex flex-col justify-center items-center">
      <PoppingTitle topTitle="Create Level">
        <Button onClick={handleNewLevelCreation} variant="ghost" size="icon">
          <Plus className="h-5 w-5" />
        </Button>
      </PoppingTitle>
    </div>
  );
};

export default NewLevel;
