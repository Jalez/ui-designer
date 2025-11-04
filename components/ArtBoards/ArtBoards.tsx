/** @format */
'use client';

import { BoardsContainer } from "./BoardsContainer";
import { useAppSelector } from "@/store/hooks/hooks";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import ArtTabs from "./ArtTabs";
import SidebySideArt from "./SidebySideArt";
import DrawBoard from "./Drawboard/DrawBoard";
import ModelBoard from "./ModelBoard/ModelBoard";
import { useState, useEffect } from "react";
import InfoInstructions from "../InfoBoard/InfoInstructions";
import Info from "../InfoBoard/Info";



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

  // Track window width for responsive behavior
  const [windowWidth, setWindowWidth] = useState<number>(0);

  useEffect(() => {
    const updateWidth = () => setWindowWidth(window.innerWidth);
    updateWidth(); // Set initial width
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate maximum scenario width
  const maxScenarioWidth = Math.max(...scenarios.map(s => s.dimensions.width));

  // Check if screen is wide enough for side-by-side layout
  const shouldShowSideBySide = windowWidth > 0 && windowWidth >= 2 * maxScenarioWidth + 10;

  const artContents = [<ModelBoard key="model" />, <DrawBoard key="draw" />];

  return (
    <>
      <div className="w-full">
        <BoardsContainer>
          {shouldShowSideBySide ? (
            <SidebySideArt contents={artContents} />
          ) : (
            <ArtTabs
              tabContents={artContents}
              tabNames={["Model solution", "Your design"]}
              startTab={0}
            />
          )}

          {/* <DrawBoard />
          <ModelBoard /> */}
          {showHotkeys && <KeyBindings />}
    
        </BoardsContainer>
      </div>
    </>
  );
};
