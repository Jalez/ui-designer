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
import { scenario } from "@/types";
import { FloatingActionButton } from "@/components/General/FloatingActionButton";
import { useCallback, useEffect, useState } from "react";
import {
  removeScenario,
  toggleImageInteractivity,
} from "@/store/slices/levels.slice";
import { Trash2, MousePointer, ImageIcon } from "lucide-react";
import PoppingTitle from "@/components/General/PoppingTitle";
import { ScenarioDimensionsWrapper } from "./ScenarioDimensionsWrapper";
import { ScenarioHoverContainer } from "./ScenarioHoverContainer";

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
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [drawWithSolution, setDrawWithSolution] = useState(false);
  const [css, setCss] = useState<string>(
    drawWithSolution ? level.solution.css : level.code.css
  );
  const [html, setHtml] = useState<string>(
    drawWithSolution ? level.solution.html : level.code.html
  );
  const [js, setJs] = useState<string>(
    drawWithSolution ? level.solution.js : level.code.js
  );

  if (!level) return null;

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
  const interactive = level.interactive;

  const handleRemoveScenario = () => {
    dispatch(
      removeScenario({ levelId: currentLevel, scenarioId: scenario.scenarioId })
    );
  };
  return (
    <div className="relative flex justify-center">
      <BoardContainer width={scenario.dimensions.width}>
        {/* <BoardTitle>Your version</BoardTitle> */}
        <Board>
          {" "}
          <ArtContainer>
            <div className="relative">
              {isCreator && (
                <ScenarioHoverContainer>
                  <div className="absolute top-2 right-2">
                    <ScenarioDimensionsWrapper 
                      scenario={scenario} 
                      levelId={currentLevel}
                      showDimensions={true}
                      setShowDimensions={() => {}}
                      onRemoveScenario={handleRemoveScenario}
                    />
                  </div>
                </ScenarioHoverContainer>
              )}
              {!isCreator && (
                <div className="absolute top-2 right-2 z-10">
                  <PoppingTitle topTitle={interactive ? "Switch to Static" : "Switch to Interactive"}>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 bg-background/80 hover:bg-background"
                      onClick={handleSwitchDrawing}
                    >
                      {interactive ? <ImageIcon className="h-4 w-4" /> : <MousePointer className="h-4 w-4" />}
                    </Button>
                  </PoppingTitle>
                </div>
              )}
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
                       newJs={js + "\n" + scenario.js}
                       scenario={scenario}
                       name="drawingUrl"
                     />
                  </div>
                }
              />
            </div>
          </ArtContainer>
        </Board>
      </BoardContainer>
    </div>
  );
};
