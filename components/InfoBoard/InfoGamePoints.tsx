'use client';

import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "../General/PoppingTitle";
import Shaker from "../General/Shaker/Shaker";
import InfoBox from "./InfoBox";
import { InfoText } from "./InfoText";

const InfoGamePoints = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const points = useAppSelector((state) => state.points);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const level = levels[currentLevel - 1];

  const isCreator = options.creator;

  if (isCreator) return null;

  return (
    <PoppingTitle
      topTitle={isCreator ? "Set Max Points" : "Total Points/Total Max Points"}
    >
      <Shaker value={points.allPoints}>
        <InfoBox>
          <InfoText>
            {points.allPoints || 0}/{points.allMaxPoints || 0}
          </InfoText>
        </InfoBox>
      </Shaker>
    </PoppingTitle>
  );
};

export default InfoGamePoints;
