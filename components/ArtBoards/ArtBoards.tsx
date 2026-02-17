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
import { useState, useEffect, useRef } from "react";
import InfoInstructions from "../InfoBoard/InfoInstructions";
import Info from "../InfoBoard/Info";



export const ArtBoards = (): React.ReactNode => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Early return if level doesn't exist - parent handles loading state
  if (!level) {
    return null;
  }

  const showHotkeys = level.showHotkeys;
  const scenarios = level.scenarios;
  
  if (!scenarios) {
    return <div>Scenarios not found</div>;
  }

  // Calculate maximum scenario dimensions
  const maxScenarioWidth = Math.max(...scenarios.map(s => s.dimensions.width));
  const maxScenarioHeight = Math.max(...scenarios.map(s => s.dimensions.height));

  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateContainerWidth();
    
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => resizeObserver.disconnect();
  }, []);

  // Check if container is wide enough for side-by-side layout (both boards fit)
  const shouldShowSideBySide = containerWidth > 0 && containerWidth >= 2 * maxScenarioWidth;

  const artContents = [<ModelBoard key="model" />, <DrawBoard key="draw" />];

  return (
    <>
      <div ref={containerRef} className="w-full h-full relative">
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

          {showHotkeys && <KeyBindings />}
        </BoardsContainer>
        <div className="absolute bottom-0 right-0 z-[100]">
          <ScenarioAdder />
        </div>
      </div>
    </>
  );
};
