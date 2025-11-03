'use client';

import { InfoSwitch } from "@/components/InfoBoard/InfoSwitch";
import { useState } from "react";
import { useAppSelector } from "@/store/hooks/hooks";

type ArtTabsProps = {
  tabNames: string[];
  tabContents: React.ReactNode[];
  startTab?: number;
};

const ArtTabs = ({
  tabNames,
  tabContents,
  startTab,
}: ArtTabsProps): React.ReactNode => {
  const [activeIndex, setActiveIndex] = useState(startTab || 0);
  const { currentLevel } = useAppSelector((state: any) => state.currentLevel);
  const level = useAppSelector((state: any) => state.levels[currentLevel - 1]);
  const solutions = useAppSelector((state: any) => state.solutions);
  
  // take the drawn-state of the current level from the solutions
  const drawnState = solutions[level.name].drawn;

  if (!level) {
    return (
      <div className="bg-red-500">
        Level not found
      </div>
    );
  }

  const handleSwitch = () => {
    setActiveIndex(prev => prev === 0 ? 1 : 0);
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <div className="mb-4">
        <InfoSwitch
          leftLabel={tabNames[0]}
          rightLabel={tabNames[1]}
          checked={activeIndex === 1}
          switchHandler={handleSwitch}
        />
      </div>
      <div className="w-full">
        {tabContents[activeIndex]}
      </div>
    </div>
  );
};

export default ArtTabs;
