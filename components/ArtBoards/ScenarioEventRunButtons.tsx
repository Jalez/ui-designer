"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AutoRunCircle } from "@/components/icons/AutoRunCircle";
import { cn } from "@/lib/utils/cn";
import { Play, Square } from "lucide-react";
import { useEventsContext } from "./EventsContext";

export function ScenarioEventRunButtons() {
  const {
    autoReplayOnMount,
    handleRunEventsClick,
    handleToggleAutoRunOnMount,
    pendingManualAutoReplay,
    sequenceRuntime,
    showEventRunControls,
  } = useEventsContext();

  if (!showEventRunControls) {
    return null;
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 shrink-0 border-0 shadow-none",
              (sequenceRuntime.autoReplay?.running || pendingManualAutoReplay) && "bg-muted hover:bg-muted/90",
            )}
            onClick={handleRunEventsClick}
            aria-label={
              sequenceRuntime.autoReplay?.running
                ? "Stop scenario run"
                : pendingManualAutoReplay
                  ? "Preparing scenario run"
                  : "Run Scenario events"
            }
          >
            {sequenceRuntime.autoReplay?.running ? (
              <Square className="h-4 w-4 shrink-0" />
            ) : pendingManualAutoReplay ? (
              <Play className="h-4 w-4 shrink-0 opacity-60" />
            ) : (
              <Play className="h-4 w-4 shrink-0" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-snug">
          {sequenceRuntime.autoReplay?.running
            ? "Stop scenario run"
            : pendingManualAutoReplay
              ? "Preparing the drawboard after refresh, then running scenario events automatically."
              : "Run Scenario events"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 shrink-0 border-0 shadow-none",
              autoReplayOnMount && "bg-muted hover:bg-muted/90",
            )}
            onClick={handleToggleAutoRunOnMount}
            aria-label="Auto Run scenario-events upon page refresh"
          >
            <AutoRunCircle className="h-4 w-4 shrink-0" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-snug">
          Auto Run scenario-events upon page refresh
        </TooltipContent>
      </Tooltip>
    </>
  );
}
