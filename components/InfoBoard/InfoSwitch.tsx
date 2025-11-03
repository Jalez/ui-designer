/** @format */
'use client';

import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface InfoSwitchProps {
  switchHandler: () => void;
  rightLabel: string;
  leftLabel: string;
  checked: boolean;
}

export const InfoSwitch = ({
  rightLabel,
  leftLabel,
  switchHandler,
  checked,
}: InfoSwitchProps) => {
  return (
    <div className="flex flex-row items-center gap-3">
      <Label className="select-none text-sm font-medium cursor-pointer" onClick={switchHandler}>
        {leftLabel}
      </Label>
      <Switch checked={checked} onCheckedChange={switchHandler} />
      <Label className="select-none text-sm font-medium cursor-pointer" onClick={switchHandler}>
        {rightLabel}
      </Label>
    </div>
  );
};
