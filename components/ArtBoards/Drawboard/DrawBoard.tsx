'use client';

import { BoardsContainer } from "../BoardsContainer";
import ScenarioAdder from "../ScenarioAdder";
import { ScenarioDrawing } from "./ScenarioDrawing";
import { useAppSelector } from "@/store/hooks/hooks";

const DrawBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }
  return (
    <div>
      <BoardsContainer>
        {scenarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No scenarios found
            </h3>
      
          </div>
        ) : (
          scenarios.map((scenario) => (
            <ScenarioDrawing key={scenario.scenarioId} scenario={scenario} />
          ))
        )}
        <ScenarioAdder />
      </BoardsContainer>
    </div>
  );
};

export default DrawBoard;
