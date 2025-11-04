import { useAppSelector } from "@/store/hooks/hooks";
import PoppingTitle from "../General/PoppingTitle";
import Shaker from "../General/Shaker/Shaker";
import InfoBox from "./InfoBox";
import { InfoText } from "./InfoText";
import { numberTimeToMinutesAndSeconds } from "@/lib/utils/numberTimeToMinutesAndSeconds";

export const InfoTime = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const points = useAppSelector((state) => state.points);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  return null;
  const completionTime = points.levels[level.name].bestTime;

  return (
    <InfoBox>
      <PoppingTitle topTitle="Best Time">
        <InfoText>
          <Shaker value={completionTime}>{completionTime}</Shaker>
        </InfoText>
      </PoppingTitle>
    </InfoBox>
  );
};
