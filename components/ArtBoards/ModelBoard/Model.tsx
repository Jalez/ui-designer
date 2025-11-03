/** @format */

import { useAppSelector } from "../../../store/hooks/hooks";
import { scenario } from "../../../types";
import { Image } from "../../General/Image/Image";
import ScreenshotWithRedux from "../../Specific/ScreenshotWithRedux/ScreenshotWithRedux";

type ModelProps = {
  scenario: scenario;
};

export const Model = ({ scenario }: ModelProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state: any) => state.solutionUrls);
  const solutionUrl = solutionUrls[scenario.scenarioId];

  return (
    <ScreenshotWithRedux
      scenarioId={scenario.scenarioId}
      imageUrl={solutionUrl}
      //   imageUrl={"lol"}
      name="solution"
    >
      <Image
        name="solution"
        imageUrl={solutionUrl}
        height={scenario.dimensions.height}
        width={scenario.dimensions.width}
      />
    </ScreenshotWithRedux>
  );
};
