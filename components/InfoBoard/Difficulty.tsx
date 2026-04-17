'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useEffect, useState } from "react";
import { changeLevelDifficulty } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import PoppingTitle from "../General/PoppingTitle";
import { Skull } from "lucide-react";
import { cn } from "@/lib/utils/cn";
//difficulty can either be easy, medium, or hard

interface Difficulties {
  easy: number;
  medium: number;
  hard: number;
}

const difficulties: Difficulties = {
  easy: 1,
  medium: 2,
  hard: 3,
};

const maxDifficultyIcons = Object.keys(difficulties).length;

/**
 * Shared skull row for level difficulty — creator can click to set; others read-only.
 * Use in the level footer menu and anywhere else difficulty should be editable.
 */
export function LevelDifficultySkulls({ iconClassName = "h-5 w-5" }: { iconClassName?: string }) {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const difficulty = level?.difficulty ?? "easy";
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";
  const { syncLevelFields } = useLevelMetaSync();
  const [difficultyLevel, setDifficultyLevel] = useState(difficulties[difficulty as keyof Difficulties]);

  useEffect(() => {
    setDifficultyLevel(difficulties[difficulty as keyof Difficulties]);
  }, [difficulty]);

  const handleChange = (value: number) => {
    const nextDifficulty = Object.keys(difficulties).find(
      (key) => difficulties[key as keyof Difficulties] === value
    ) as keyof Difficulties;
    dispatch(changeLevelDifficulty({ levelId: currentLevel, difficulty: nextDifficulty }));
    syncLevelFields(currentLevel - 1, ["difficulty"]);
  };

  return (
    <div className="flex items-center justify-center gap-1">
      {Array.from({ length: maxDifficultyIcons }).map((_, index) => {
        const difficultyValue = index + 1;
        return (
          <Skull
            key={index}
            className={cn(
              iconClassName,
              "fill-none shrink-0 transition-colors",
              difficultyValue <= difficultyLevel ? "text-red-500" : "text-primary/45",
              !isCreator && "cursor-default",
              isCreator && "cursor-pointer hover:text-red-400"
            )}
            onClick={() => {
              if (isCreator) {
                setDifficultyLevel(difficultyValue);
                handleChange(difficultyValue);
              }
            }}
          />
        );
      })}
    </div>
  );
}

const Difficulty = () => {
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";

  return (
    <div className="flex flex-col justify-center items-center m-0 p-0">
      <PoppingTitle topTitle={isCreator ? "Set Difficulty" : "Difficulty"}>
        <LevelDifficultySkulls />
      </PoppingTitle>
    </div>
  );
};

export default Difficulty;
