import { useAppSelector } from "@/store/hooks/hooks";
import { changeMaxPoints } from "@/store/slices/levels.slice";
import PoppingTitle from "../General/PoppingTitle";
import Shaker from "../General/Shaker/Shaker";
import InfoBox from "./InfoBox";
import { InfoText } from "./InfoText";
import { LevelData } from "./LevelData";

const InfoLevelPoints = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const points = useAppSelector((state) => state.points);
  const level = levels[currentLevel - 1];

  const isCreator = options.creator;

  return (
    <PoppingTitle topTitle={isCreator ? "Set Max Points" : "Points/Max Points"}>
      <Shaker value={level.points}>
        <InfoBox>
          <InfoText>
            {!isCreator && (
              <>
                {points.levels[level.name].points}
                {"/"}
              </>
            )}

            <LevelData
              reduxState="maxPoints"
              actionToDispatch={changeMaxPoints}
            />
          </InfoText>
        </InfoBox>
      </Shaker>
    </PoppingTitle>
  );
};

export default InfoLevelPoints;
