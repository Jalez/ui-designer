'use client';

import { useEffect, useState } from "react";
import { useAppDispatch } from "@/store/hooks/hooks";
import { useAppSelector } from "@/store/hooks/hooks";
import { InfoBoard } from "./InfoBoard";
import { InfoColor } from "./InfoColor";
import { InfoColors } from "./InfoColors";
import { InfoText } from "./InfoText";
import { InfoTime } from "./InfoTime";
import Timer from "../General/Timer";
import PoppingTitle from "../General/PoppingTitle";
import InfoBox from "./InfoBox";
import InfoLevelPoints from "./InfoLevelPoints";
import { ThresholdsEditor } from "./ThresholdsEditor";
import { NextThreshold } from "./NextThreshold";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart3, Clock3, RotateCcw } from "lucide-react";
import Difficulty, { LevelDifficultySkulls } from "./Difficulty";
import { numberTimeToMinutesAndSeconds } from "@/lib/utils/numberTimeToMinutesAndSeconds";
import { resetLevel } from "@/store/slices/levels.slice";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import Shaker from "@/components/General/Shaker/Shaker";
import { CompactMenuButton, compactMenuLabelClass } from "@/components/General/CompactMenuButton";
import { toast } from "sonner";

function CompactMenuItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md bg-background/80 px-3 py-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex min-h-9 items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function LevelFooterMenu() {
  const dispatch = useAppDispatch();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const points = useAppSelector((state) => state.points);
  const collaboration = useOptionalCollaboration();
  const level = levels[currentLevel - 1];

  if (!level) return null;

  const isCreator = options.creator;
  const hasAccuracy = Boolean(points.levels[level.name]);
  const levelPoints = points.levels[level.name]?.points ?? level.points;
  const levelMaxPoints = level.maxPoints;
  const meanAccuracyKnown = points.levels[level.name]?.meanAccuracyKnown !== false;
  const levelAccuracy = meanAccuracyKnown ? (points.levels[level.name]?.accuracy ?? 0) : 0;
  const sortedThresholds = [...level.pointsThresholds].sort((a, b) => a.accuracy - b.accuracy);
  const reachedThresholdCount = sortedThresholds.filter((threshold) => levelAccuracy >= threshold.accuracy).length;
  const nextThreshold = sortedThresholds.find((threshold) => levelAccuracy < threshold.accuracy) ?? null;
  const nextThresholdLabel = nextThreshold
    ? `${nextThreshold.accuracy}% -> ${Math.ceil((nextThreshold.pointsPercent / 100) * level.maxPoints)} pts`
    : "Max pts!";
  const handleResetLevel = () => {
    if (collaboration?.resetRoomState) {
      if (!collaboration.isConnected) {
        toast.error("Shared reset is unavailable until the room connection is ready.");
        return;
      }
      collaboration.resetRoomState("level", currentLevel - 1);
      return;
    }

    dispatch(resetLevel(currentLevel));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <CompactMenuButton icon={BarChart3} label="Level" text="Level">
          <Shaker
            value={reachedThresholdCount}
            className="inline-flex items-center justify-center gap-1 max-[519px]:flex-col"
          >
            <span className={`${compactMenuLabelClass} min-[520px]:hidden`}>
              Level
            </span>
            <BarChart3 className="h-4 w-4" />
            <span className="hidden min-[520px]:inline text-xs font-medium">Level</span>
          </Shaker>
        </CompactMenuButton>
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-72 space-y-3">
        <div className="rounded-md border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Level</span>
          </div>
          <div className="mt-3 space-y-3">
            <CompactMenuItem label="Points">
              <div className="text-sm font-semibold text-foreground">
                {levelPoints}/{levelMaxPoints}
              </div>
            </CompactMenuItem>
            <CompactMenuItem label="Difficulty">
              <LevelDifficultySkulls iconClassName="h-4 w-4" />
            </CompactMenuItem>
            {hasAccuracy && (
              <CompactMenuItem label="Mean accuracy">
                <div className="text-sm font-semibold text-foreground">
                  {meanAccuracyKnown ? `${levelAccuracy}%` : "—"}
                </div>
              </CompactMenuItem>
            )}
            <CompactMenuItem label="Next Threshold">
              <div className="text-sm font-semibold text-foreground">
                {nextThresholdLabel}
              </div>
            </CompactMenuItem>
            {isCreator ? (
              <div className="rounded-md bg-background/80 px-3 py-2 text-center">
                <ThresholdsEditor />
              </div>
            ) : null}
            {level.buildingBlocks?.colors?.length ? (
              <CompactMenuItem label="Colors">
                <div className="flex max-w-full flex-row flex-wrap items-center justify-center gap-1.5">
                  {level.buildingBlocks.colors.map((color) => (
                    <InfoColor key={color} color={color} />
                  ))}
                </div>
              </CompactMenuItem>
            ) : null}
            <CompactMenuItem label="Actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={handleResetLevel}
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset level</span>
              </Button>
            </CompactMenuItem>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TimeFooterMenu() {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const points = useAppSelector((state) => state.points);
  const level = levels[currentLevel - 1];
  const [compactTimeSpent, setCompactTimeSpent] = useState("00:00");
  const levelPoints = level ? points.levels[level.name] : null;

  useEffect(() => {
    if (!level || options.creator || !levelPoints) {
      setCompactTimeSpent("00:00");
      return undefined;
    }

    const startTime = level.timeData.startTime;
    if (!startTime) {
      setCompactTimeSpent("00:00");
      return undefined;
    }

    const update = () => {
      setCompactTimeSpent(numberTimeToMinutesAndSeconds(Date.now() - startTime));
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [level, levelPoints, options.creator]);

  if (!level || options.creator || !levelPoints) {
    return null;
  }

  const bestTime = levelPoints.bestTime ?? "No time yet";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <CompactMenuButton icon={Clock3} label="Time" text="Time" />
      </PopoverTrigger>
      <PopoverContent side="top" align="center" className="w-64 space-y-3">
        <div className="rounded-md border bg-muted/40 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            <span>Time Details</span>
          </div>
          <div className="mt-3 space-y-3">
            <CompactMenuItem label="Time Spent">
              <div className="text-sm font-semibold text-primary">
                {compactTimeSpent}
              </div>
            </CompactMenuItem>
            <CompactMenuItem label="Best Time">
              <div className="text-sm font-semibold text-foreground">
                {bestTime}
              </div>
            </CompactMenuItem>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CompactInfoMenus() {
  return (
    <>
      <LevelFooterMenu />
      <TimeFooterMenu />
    </>
  );
}

const Info = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const points = useAppSelector((state) => state.points);
  const level = levels[currentLevel - 1];

  if (!level) return null;

  const isCreator = options.creator;
  const hasAccuracy = Boolean(points.levels[level.name]);
  const meanAccuracyKnown = points.levels[level.name]?.meanAccuracyKnown !== false;

  return (
    <InfoBoard>
      <div className="flex w-full flex-nowrap items-center justify-around">
        <InfoLevelPoints />
        {!isCreator && <Timer />}
        {!isCreator && <InfoTime />}
        {hasAccuracy && (
          <InfoBox>
            <PoppingTitle topTitle="Mean accuracy">
              <InfoText>
                {meanAccuracyKnown ? `${points.levels[level.name].accuracy}%` : "—"}
              </InfoText>
            </PoppingTitle>
          </InfoBox>
        )}
        <NextThreshold />
        {isCreator && <ThresholdsEditor />}
        {isCreator && (
          <InfoBox>
            <Difficulty />
          </InfoBox>
        )}
        <InfoBox>
          <InfoColors />
        </InfoBox>
      </div>
    </InfoBoard>
  );
};

export default Info;
