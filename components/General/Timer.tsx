'use client';

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { numberTimeToMinutesAndSeconds } from "@/lib/utils/numberTimeToMinutesAndSeconds";
import { resetLevel, startLevelTimer } from "@/store/slices/levels.slice";
import PoppingTitle from "./PoppingTitle";

const Timer = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const level = levels[currentLevel - 1];
  const [timeSpent, setTimeSpent] = useState(numberTimeToMinutesAndSeconds(-1));
  const room = useAppSelector((state) => state.room);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    const startTime = level.timeData.startTime;
    if (!startTime) {
      dispatch(resetLevel(currentLevel));
      dispatch(startLevelTimer(currentLevel));
      return;
    } else if (startTime) {
      setTimeSpent(
        numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
      );

      interval = setInterval(() => {
        setTimeSpent(
          numberTimeToMinutesAndSeconds(new Date().getTime() - startTime)
        );
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [currentLevel, level.timeData.startTime]);

  return (
    <div
      className="flex justify-center items-center flex-col m-0 z-10"
    >
      <PoppingTitle topTitle="Time Spent">
        <strong className="text-primary">{timeSpent}</strong>
      </PoppingTitle>
    </div>
  );
};

export default Timer;

