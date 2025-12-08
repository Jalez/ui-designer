'use client';

import { useState } from "react";
import { ScenarioDimensions } from "./ScenarioDimensions";
import { scenario } from "@/types";

type ScenarioDimensionsWrapperProps = {
  scenario: scenario;
  levelId: number;
  showDimensions: boolean;
  setShowDimensions: (show: boolean) => void;
  onRemoveScenario?: () => void;
};

export const ScenarioDimensionsWrapper = ({
  scenario,
  levelId,
  showDimensions,
  setShowDimensions,
  onRemoveScenario,
}: ScenarioDimensionsWrapperProps) => {
  const [selectOpen, setSelectOpen] = useState(false);
  const [editDimensions, setEditDimensions] = useState(false);

  // Keep dimensions visible if select is open or editing
  const shouldShow = showDimensions || editDimensions || selectOpen;

  return (
    <ScenarioDimensions 
      scenario={scenario} 
      levelId={levelId}
      showDimensions={shouldShow}
      setShowDimensions={setShowDimensions}
      selectOpen={selectOpen}
      setSelectOpen={setSelectOpen}
      editDimensions={editDimensions}
      setEditDimensions={setEditDimensions}
      onRemoveScenario={onRemoveScenario}
    />
  );
};
