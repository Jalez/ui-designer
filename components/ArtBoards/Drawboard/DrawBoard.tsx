'use client';

import { BoardsContainer } from "../BoardsContainer";
import { EventsBoundScenarioDrawing } from "@/events/components/EventsBoundScenarioDrawing";
import { EventProvider } from "@/events/components/EventContext";
import { useAppSelector } from "@/store/hooks/hooks";

const DrawBoard = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";
  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }
  return (
    <EventProvider>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <BoardsContainer>
          {scenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No scenarios found
              </h3>
            </div>
          ) : (
            scenarios.map((scenario) => (
              <EventsBoundScenarioDrawing key={scenario.scenarioId} scenario={scenario} />
            ))
          )}
        </BoardsContainer>
      </div>
    </EventProvider>
  );
};

export default DrawBoard;
