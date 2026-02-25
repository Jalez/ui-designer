'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import { InfoBoard } from "./InfoBoard";
import { InfoColors } from "./InfoColors";
import { InfoText } from "./InfoText";
import { InfoTime } from "./InfoTime";
import Timer from "../General/Timer";
import PoppingTitle from "../General/PoppingTitle";
import InfoBox from "./InfoBox";
import InfoLevelPoints from "./InfoLevelPoints";
import { ThresholdsEditor } from "./ThresholdsEditor";
import { NextThreshold } from "./NextThreshold";

const Info = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const points = useAppSelector((state) => state.points);
  const level = levels[currentLevel - 1];

  const isCreator = options.creator;

  if (!level) return null;
  return (
    <div>
      <InfoBoard>
        <div className="flex flex-row justify-around items-center w-full flex-nowrap">

          <InfoLevelPoints />
          {!isCreator && <Timer />}
          {!isCreator && <InfoTime />}
          {points.levels[level.name] && (
            <InfoBox>
              <PoppingTitle topTitle="Accuracy">
                <InfoText>{points.levels[level.name].accuracy}%</InfoText>
              </PoppingTitle>
            </InfoBox>
          )}
          {isCreator ? <ThresholdsEditor /> : <NextThreshold />}

          <InfoBox>
            <InfoColors />
          </InfoBox>
        </div>
        {/* <InfoPictures /> */}
      </InfoBoard>
    </div>
  );
};

export default Info;
