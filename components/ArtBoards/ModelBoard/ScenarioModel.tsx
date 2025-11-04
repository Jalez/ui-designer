/** @format */
'use client';

import { Diff } from "./Diff/Diff";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { ModelArtContainer } from "./ModelArtContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { scenario } from "@/types";
import { Image } from "@/components/General/Image/Image";
import { FloatingActionButton } from "@/components/General/FloatingActionButton";
import { useCallback, useState } from "react";
import { toggleShowModelSolution } from "@/store/slices/levels.slice";

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
    <div className="relative flex justify-center">
      <BoardContainer width={scenario.dimensions.width}>
        <Board>
          <ModelArtContainer scenario={scenario}>
            <div className="relative">
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
              <FloatingActionButton
                leftLabel="diff"
                rightLabel="model"
                checked={showModel}
                onCheckedChange={handleSwitchModel}
                tooltip="Toggle between difference view and model image"
                showOnHover={true}
                storageKey={`floating-button-model-${scenario.scenarioId}`}
              />
            </div>
          </ModelArtContainer>
        </Board>
        {/* <BoardTitle side="right">Model version</BoardTitle> */}
      </BoardContainer>
    </div>
  );
};


