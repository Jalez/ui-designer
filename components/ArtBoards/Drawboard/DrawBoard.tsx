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
          <h3 className="text-2xl font-semibold text-center text-primary">
            No scenarios found. Add a new scenario to get started.
          </h3>
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
