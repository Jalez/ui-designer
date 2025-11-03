'use client';

import { Card } from "@/components/ui/card";
import { Board } from "./Board";
import { BoardContainer } from "./BoardContainer";
import { BoardTitle } from "./BoardTitle";
import { useAppSelector } from "@/store/hooks/hooks";
import { Level } from "@/types";
import { InfoText } from "@/components/InfoBoard/InfoText";
import { BoardsContainer } from "./BoardsContainer";
import { secondaryColor, mainColor } from "@/constants";

const ScoreBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector(
    (state) => state.levels[currentLevel - 1]
  ) as Level;

  const showTimeData = (level: Level) => {
    return Object.entries(level.timeData.pointAndTime).map(([key, value]) => {
      return (
        <InfoText key={key}>
          {key}: {value}
        </InfoText>
      );
    });
  };
  const timeData = showTimeData(level);

  return (
    <BoardsContainer>
      <BoardContainer width={400}>
        <BoardTitle side="left">Points</BoardTitle>
        <Board>
          <Card
            className="p-4"
            style={{
              backgroundColor: secondaryColor,
              color: mainColor,
            }}
          >
            {timeData}
          </Card>
        </Board>
        <BoardTitle side="right">Time</BoardTitle>
      </BoardContainer>
    </BoardsContainer>
  );
};

export default ScoreBoard;
