'use client';

import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { updatePointsThresholds } from "@/store/slices/levels.slice";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import InfoBox from "./InfoBox";

export const ThresholdsEditor = () => {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const [open, setOpen] = useState(false);

  if (!level) return null;

  const thresholds = level.pointsThresholds ?? [
    { accuracy: 70, pointsPercent: 25 },
    { accuracy: 85, pointsPercent: 60 },
    { accuracy: 95, pointsPercent: 100 },
  ];

  const sorted = [...thresholds].sort((a, b) => a.accuracy - b.accuracy);

  const update = (updated: { accuracy: number; pointsPercent: number }[]) => {
    dispatch(updatePointsThresholds({ levelId: currentLevel, thresholds: updated }));
  };

  const handleChange = (
    index: number,
    field: "accuracy" | "pointsPercent",
    value: string
  ) => {
    const next = sorted.map((t, i) =>
      i === index ? { ...t, [field]: Math.min(100, Math.max(0, Number(value))) } : t
    );
    update(next);
  };

  const handleAdd = () => {
    const next = [...sorted, { accuracy: 100, pointsPercent: 100 }];
    update(next);
  };

  const handleRemove = (index: number) => {
    const next = sorted.filter((_, i) => i !== index);
    update(next);
  };

  return (
    <InfoBox>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="cursor-pointer hover:opacity-70 transition-opacity text-sm font-semibold text-primary">
            Thresholds
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4 space-y-3" align="center" side="top">
          <p className="text-sm font-semibold">Points Thresholds</p>
          <p className="text-xs text-muted-foreground">
            Reach accuracy % to earn that % of max points.
          </p>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 gap-y-0.5 items-center text-xs text-muted-foreground px-1">
              <span>Accuracy %</span>
              <span />
              <span>Points %</span>
              <span />
            </div>
            {sorted.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 items-center">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={t.accuracy}
                  onChange={(e) => handleChange(i, "accuracy", e.target.value)}
                  className="h-9 text-sm"
                />
                <span className="text-muted-foreground text-sm">→</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={t.pointsPercent}
                  onChange={(e) => handleChange(i, "pointsPercent", e.target.value)}
                  className="h-9 text-sm"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 shrink-0"
                  onClick={() => handleRemove(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4 mr-1" /> Add threshold
          </Button>
        </PopoverContent>
      </Popover>
    </InfoBox>
  );
};
