/** @format */
'use client';

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { Image } from "@/components/General/Image/Image";
import { InfoSwitch } from "@/components/InfoBoard/InfoSwitch";
import { useCallback } from "react";
import { toggleShowModelSolution } from "@/store/slices/levels.slice";
import { secondaryColor, mainColor } from "@/constants";
import InfoInstructions from "@/components/InfoBoard/InfoInstructions";
import Info from "@/components/InfoBoard/Info";

type ScenarioModelProps = {
  scenario: scenario;
};

export const ScenarioModel = ({
  scenario,
}: ScenarioModelProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level.showModelPicture;
  const dispatch = useAppDispatch();
  const solutionUrls = useAppSelector((state: any) => state.solutionUrls);
  const solutionUrl = solutionUrls[scenario.scenarioId];

  const handleSwitchModel = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
  }, [currentLevel, dispatch]);

  return (
    <div className="relative flex justify-center m-8">
      <div
        className="absolute z-10 flex justify-center items-center flex-row p-[10px] -top-5"

      >
        {scenario.dimensions.width + " px"}
      </div>
      <div
        className="absolute z-10 flex justify-center items-center p-[10px] -right-[35px] top-[calc(50%-30px)] -translate-y-1/2 [writing-mode:vertical-lr]"
      >
        {scenario.dimensions.height + " px"}
      </div>
      <BoardContainer width={scenario.dimensions.width}>
        <Board>
          <ModelArtContainer scenario={scenario}>
            {/* {!scenario.solutionUrl ? (
              <Frame
                id="DrawBoard"
                newCss={level.solution.css}
                newHtml={level.solution.html}
                newJs={level.solution.js}
                scenario={scenario}
                name="solutionUrl"
              />
            ) : */}
            {showModel && solutionUrl ? (
              <Image
                name="solution"
                imageUrl={solutionUrl}
                height={scenario.dimensions.height}
                width={scenario.dimensions.width}
              />
            ) : (
              <Diff scenario={scenario} />
            )}
          </ModelArtContainer>
          <div
            className="w-full flex justify-around items-center flex-col py-3 px-4 border-t border-border"
            style={{
              backgroundColor: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
            }}
          >
            <InfoSwitch
              rightLabel={"model"}
              leftLabel={"diff"}
              checked={showModel}
              switchHandler={handleSwitchModel}
            />
                          <InfoInstructions>
            <Info />
          </InfoInstructions>
          </div>
        </Board>
        {/* <BoardTitle side="right">Model version</BoardTitle> */}
      </BoardContainer>
    </div>
  );
};
