/** @format */
"use client";

import { useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toggleShowModelSolution } from "@/store/slices/levels.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

export type DiffModelToggleContentProps = {
  leftLabel: string;
  rightLabel: string;
};

/** Diff / model switch row only (no drag wrapper). Use inside a shared `DraggableFloatingPanel` with `onDragStateChange`. */
export function DiffModelToggleContent({
  leftLabel,
  rightLabel,
}: DiffModelToggleContentProps) {
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const showModel = level?.showSolutionImageInsteadOfDiff ?? true;
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();

  const onCheckedChange = useCallback(() => {
    dispatch(toggleShowModelSolution(currentLevel));
    syncLevelFields(currentLevel - 1, ["showSolutionImageInsteadOfDiff"]);
  }, [currentLevel, dispatch, syncLevelFields]);
  const handleSwitchChange = (nextChecked: boolean) => {
    onCheckedChange();
  };

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onCheckedChange();
  };

  return (
    <div className="flex flex-row items-center gap-3">
      <Label
        className="cursor-pointer select-none text-sm font-medium text-foreground"
        onClick={handleLabelClick}
      >
        {leftLabel}
      </Label>
      <Switch checked={showModel} onCheckedChange={handleSwitchChange} />
      <Label
        className="cursor-pointer select-none text-sm font-medium text-foreground"
        onClick={handleLabelClick}
      >
        {rightLabel}
      </Label>
    </div>
  );
}
