/** @format */
'use client';

import "./ArtBoard.css";
import { BoardsContainer } from "./BoardsContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import ArtTabs from "./ArtTabs";
import DrawBoard from "./Drawboard/DrawBoard";
import ModelBoard from "./ModelBoard/ModelBoard";



export const ArtBoards = (): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showHotkeys = level.showHotkeys;

  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  const scenarios = level.scenarios;
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }

  return (
    <>
      <div className="w-full">
        <BoardsContainer>
          <ArtTabs
            tabContents={[<ModelBoard key="model" />, <DrawBoard key="draw" />]}
            tabNames={["Model solution", "Your design"]}
            startTab={0}
          />
          
          {/* <DrawBoard />
          <ModelBoard /> */}
          {showHotkeys && <KeyBindings />}
        </BoardsContainer>
      </div>
    </>
  );
};
