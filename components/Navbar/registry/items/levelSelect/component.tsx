"use client";

import { LevelSelect } from "@/components/General/LevelControls/LevelControls";
import type { NavbarResponsiveSlot } from "../../types";

type LevelSelectItemProps = {
  levelHandler: (pickedLevel: number) => void;
  spot: string;
  slot: NavbarResponsiveSlot;
  tourSpotProps: (spot: string, slot: NavbarResponsiveSlot) => Record<string, string>;
};

export function LevelSelectItem({
  levelHandler,
  spot,
  slot,
  tourSpotProps,
}: LevelSelectItemProps) {
  return (
    <div className="flex flex-1 min-w-0" {...tourSpotProps(spot, slot)}>
      <div className="w-full rounded-md px-2 py-1.5">
        <div className="flex-1 min-w-0">
          <LevelSelect levelHandler={levelHandler} compact compactLabel="Levels" />
        </div>
      </div>
    </div>
  );
}
