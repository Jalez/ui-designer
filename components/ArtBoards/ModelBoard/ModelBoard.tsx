'use client';

import { BoardsContainer } from "../BoardsContainer";
import { ScenarioModel } from "./ScenarioModel";
import { useAppSelector } from "@/store/hooks/hooks";

const ModelBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);

  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";

  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <BoardsContainer>
        {scenarios.map((scenario) => (
          <ScenarioModel key={scenario.scenarioId} scenario={scenario} />
        ))}
      </BoardsContainer>
    </div>
  );
};

export default ModelBoard;
