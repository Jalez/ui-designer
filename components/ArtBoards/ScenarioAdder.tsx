'use client';

import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addNewScenario } from "@/store/slices/levels.slice";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

type ScenarioAdderProps = {
  className?: string;
};

const ScenarioAdder = ({ className }: ScenarioAdderProps) => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";
  const { syncLevelFields } = useLevelMetaSync();

  if (!isCreator) return null;

  const handleAddNewScenario = () => {
    dispatch(addNewScenario(currentLevel as number));
    syncLevelFields((currentLevel as number) - 1, ["scenarios"]);
  };

  return (
    <PoppingTitle topTitle="Add scenario">
      <Button
        onClick={handleAddNewScenario}
        variant="ghost"
        size="icon"
        className={className}
      >
        <ImagePlus className="h-5 w-5" />
      </Button>
    </PoppingTitle>
  );
};

export default ScenarioAdder;
