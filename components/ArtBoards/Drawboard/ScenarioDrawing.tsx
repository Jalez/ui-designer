'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { Image } from "@/components/General/Image/Image";
import { ArtContainer } from "../ArtContainer";
import { Frame } from "../Frame";
import "./Drawboard.css";
import { SlideShower } from "./ImageContainer/SlideShower";
import { BoardContainer } from "../BoardContainer";
import { Board } from "../Board";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { scenario } from "@/types";
import { InfoSwitch } from "@/components/InfoBoard/InfoSwitch";
import { useCallback, useEffect, useState } from "react";
import {
  changeScenarioDimensions,
  removeScenario,
  toggleImageInteractivity,
} from "@/store/slices/levels.slice";
import { Trash2 } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { secondaryColor, mainColor } from "@/constants";

type ScenarioDrawingProps = {
  scenario: scenario;
};

export const ScenarioDrawing = ({
  scenario,
}: ScenarioDrawingProps): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const solutionUrls = useAppSelector((state: any) => state.solutionUrls);
  const solutionUrl = solutionUrls[scenario.scenarioId];
  const dispatch = useAppDispatch();
  const [editDimensions, setEditDimensions] = useState(false);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [dimensionWidth, setDimensionWidth] = useState(
    scenario.dimensions.width
  );
  const [dimensionHeight, setDimensionHeight] = useState(
    scenario.dimensions.height
  );
  const [drawWithSolution, setDrawWithSolution] = useState(
    isCreator ? true : false
  );
  const [css, setCss] = useState<string>(
    drawWithSolution ? level.solution.css : level.code.css
  );
  const [html, setHtml] = useState<string>(
    drawWithSolution ? level.solution.html : level.code.html
  );
  const [js, setJs] = useState<string>(
    drawWithSolution ? level.solution.js : level.code.js
  );

  if (!level) return <div>loading...</div>;

  useEffect(() => {
    setCss(drawWithSolution ? level.solution.css : level.code.css);
    setHtml(drawWithSolution ? level.solution.html : level.code.html);
    setJs(drawWithSolution ? level.solution.js : level.code.js);
  }, [drawWithSolution, level.code, level.solution]);

  const handleSwitchDrawing = useCallback(() => {
    if (isCreator) {
      setDrawWithSolution(!drawWithSolution);
    } else {
      dispatch(toggleImageInteractivity(currentLevel));
    }
  }, [currentLevel, dispatch, drawWithSolution, isCreator]);

  const handleStaticDimensionClick = () => {
    setEditDimensions(!editDimensions);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditDimensions(false);
    handleDimensionChange("width", dimensionWidth);
    handleDimensionChange("height", dimensionHeight);
  };

  const handleDimensionLeave = () => {
    if (editDimensions) {
      setEditDimensions(false);
      handleDimensionChange("width", dimensionWidth);
      handleDimensionChange("height", dimensionHeight);
    }
  };

  const updateDimensionHeight = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensionHeight(+e.target.value);
  };

  const updateDimensionWidth = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDimensionWidth(+e.target.value);
  };

  const handleDimensionChange = (
    dimensionType: "width" | "height",
    value: number
  ) => {
    dispatch(
      changeScenarioDimensions({
        levelId: currentLevel,
        scenarioId: scenario.scenarioId,
        dimensionType,
        value,
      })
    );
  };
  const interactive = level.interactive;

  const handleRemoveScenario = () => {
    dispatch(
      removeScenario({ levelId: currentLevel, scenarioId: scenario.scenarioId })
    );
  };
  return (
    <div
      onMouseLeave={handleDimensionLeave}
      className="relative flex justify-center m-8"
    >
      {isCreator && (
        <>
          <div
            className="absolute z-10 flex justify-center items-center flex-row p-[10px] -top-5"
            style={{
              color: secondaryColor,
              backgroundColor: mainColor,
            }}
          >
            {!editDimensions ? (
              <div
                onClick={handleStaticDimensionClick}
                className="cursor-pointer select-none"
              >
                {scenario.dimensions.width + " px"}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <input
                  className="w-20 text-center bg-[#222] text-xl border-none text-white font-[Kontakt] p-0 m-0 outline-none"
                  type="number"
                  value={dimensionWidth}
                  onChange={updateDimensionWidth}
                />
                PX
              </form>
            )}
          </div>
          <div
            className="absolute z-10 flex justify-center items-center p-[10px] -right-[35px] top-[calc(50%-30px)] -translate-y-1/2 [writing-mode:vertical-lr]"
            style={{
              color: secondaryColor,
              backgroundColor: mainColor,
            }}
          >
            {!editDimensions ? (
              <div
                onClick={handleStaticDimensionClick}
                className="cursor-pointer select-none"
              >
                {scenario.dimensions.height + " px"}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <input
                  className="h-20 max-w-full text-center bg-[#222] text-xl border-none text-white font-[Kontakt]"
                  type="number"
                  value={dimensionHeight}
                  onChange={updateDimensionHeight}
                />
                PX
              </form>
            )}
          </div>
        </>
      )}

      <BoardContainer width={scenario.dimensions.width}>
        {/* <BoardTitle>Your version</BoardTitle> */}
        <Board>
          {" "}
          <ArtContainer>
            <SlideShower
              sliderHeight={scenario.dimensions.height}
              showStatic={!interactive && !isCreator}
              staticComponent={
                <Image
                  imageUrl={solutionUrl}
                  height={scenario.dimensions.height}
                  width={scenario.dimensions.width}
                />
              }
              slidingComponent={
                <div
                  className="overflow-hidden relative"
                  style={{
                    height: `${scenario.dimensions.height}px`,
                    width: `${scenario.dimensions.width}px`,
                  }}
                >
                  <Frame
                    id="DrawBoard"
                    events={level.events || []}
                    newCss={css}
                    newHtml={html}
                    newJs={js}
                    scenario={scenario}
                    name="drawingUrl"
                  />
                </div>
              }
            />
          </ArtContainer>
          <div
            className="w-full flex justify-around items-center flex-row py-3 px-4 border-t border-border"
            style={{
              backgroundColor: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
            }}
          >
            {isCreator ? (
              <>
                <InfoSwitch
                  rightLabel={"Solution"}
                  leftLabel={"Template"}
                  checked={drawWithSolution}
                  switchHandler={handleSwitchDrawing}
                />
                <PoppingTitle topTitle="Remove Scenario">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleRemoveScenario}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </PoppingTitle>
              </>
            ) : (
              <InfoSwitch
                rightLabel={"Interactive"}
                leftLabel={"Slider"}
                checked={interactive}
                switchHandler={handleSwitchDrawing}
              />
            )}
          </div>
        </Board>
      </BoardContainer>
    </div>
  );
};
