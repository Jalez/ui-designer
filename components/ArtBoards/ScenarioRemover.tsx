'use client';

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { removeScenario } from "@/store/slices/levels.slice";
import PoppingTitle from "@/components/General/PoppingTitle";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import { cn } from "@/lib/utils/cn";

type ScenarioRemoverProps = {
  scenarioId: string | null;
  /** When false, at least one scenario must remain. */
  canRemove: boolean;
  className?: string;
};

const ScenarioRemover = ({ scenarioId, canRemove, className }: ScenarioRemoverProps) => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const options = useAppSelector((state) => state.options);
  const isCreator = options.mode === "creator";
  const { syncLevelFields } = useLevelMetaSync();

  if (!isCreator) return null;

  const handleRemove = () => {
    if (!scenarioId || !canRemove) return;
    dispatch(removeScenario({ levelId: currentLevel, scenarioId }));
    syncLevelFields(currentLevel - 1, ["scenarios"]);
  };

  return (
    <PoppingTitle topTitle={canRemove ? "Remove scenario" : "At least one scenario is required"}>
      <Button
        onClick={handleRemove}
        variant="ghost"
        size="icon"
        disabled={!scenarioId || !canRemove}
        className={cn("text-destructive hover:text-destructive disabled:opacity-40", className)}
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </PoppingTitle>
  );
};

export default ScenarioRemover;
