'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useState } from "react";
import { changeLevelDifficulty } from "@/store/slices/levels.slice";
import PoppingTitle from "../General/PoppingTitle";
import { Star } from "lucide-react";
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
const Difficulty = () => {
  // get difficulty from level
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const difficulty = level.difficulty;
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [stars, setStars] = useState(difficulties[difficulty]);
  //   if difficulty is easy, value
  const handleChange = (value: number) => {
    // fidn the difficulty
    const difficulty = Object.keys(difficulties).find(
      (key) => difficulties[key as keyof Difficulties] === value
    ) as keyof Difficulties;
    dispatch(changeLevelDifficulty({ levelId: currentLevel, difficulty }));
  };

  const maxStars = Object.keys(difficulties).length;

  return (
    <div className="flex flex-col justify-center items-center m-0 p-0">
      <PoppingTitle
        topTitle={isCreator ? "Set Difficulty" : "Difficulty"}
      >
        <div className="flex gap-1">
          {Array.from({ length: maxStars }).map((_, index) => {
            const starValue = index + 1;
            return (
              <Star
                key={index}
                className={cn(
                  "h-5 w-5 transition-colors",
                  starValue <= stars
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-primary/20 text-primary",
                  !isCreator && "cursor-default",
                  isCreator && "cursor-pointer hover:fill-yellow-300 hover:text-yellow-300"
                )}
                onClick={() => {
                  if (isCreator) {
                    const newValue = starValue;
                    setStars(newValue);
                    handleChange(newValue);
                  }
                }}
              />
            );
          })}
        </div>
      </PoppingTitle>
    </div>
  );
};

export default Difficulty;
