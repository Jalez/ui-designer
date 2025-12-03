'use client';

import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { addNewScenario } from "@/store/slices/levels.slice";

const ScenarioAdder = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  if (!isCreator) return null;

  const handleAddNewScenario = () => {
    dispatch(addNewScenario(currentLevel as number));
  };

  return (
    <Button
      onClick={handleAddNewScenario}
      variant="ghost"
      className="flex flex-col items-center justify-center h-full w-[280px] p-[10px] m-4 hover:bg-accent/50"
    >
      <ImagePlus className="h-[100px] w-[100px]" />
      <span className="mt-2">Add a new scenario</span>
    </Button>
  );
};

export default ScenarioAdder;
