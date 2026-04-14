"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AutoRunCircle } from "@/components/icons/AutoRunCircle";
import { cn } from "@/lib/utils/cn";
import { Play, Square } from "lucide-react";
import { useEventsActions, useEventsRuntime } from "./EventsContext";

export function ScenarioEventRunButtons() {
  const {
    autoReplayQueued,
    hasFreshSequenceAccuracy,
    sequenceRuntime,
    showEventRunControls,
  } = useEventsRuntime();
  const {
    handleStartScenarioEventRun,
    handleStopScenarioEventRun,
  } = useEventsActions();

  const isRunning = Boolean(sequenceRuntime.autoReplay?.running);
  const isQueued = autoReplayQueued && !isRunning;

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
              isQueued && "bg-muted hover:bg-muted/90",
            )}
            onClick={handleStartScenarioEventRun}
            disabled={isRunning || isQueued}
            aria-label={
              isQueued
                ? "Preparing scenario run"
                : hasFreshSequenceAccuracy
                  ? "Re-run scenario events"
                  : "Run Scenario events"
            }
          >
            <Play className={cn("h-4 w-4 shrink-0", isQueued && "opacity-60")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-snug">
          {isQueued
            ? "Waiting for the same refresh-ready conditions as auto-run, then starting scenario events."
            : hasFreshSequenceAccuracy
              ? "Re-run through every event in order, even if nothing has changed."
              : "Run through each scenario event in order."}
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
              isRunning && "bg-muted hover:bg-muted/90",
            )}
            onClick={handleStopScenarioEventRun}
            disabled={!isRunning}
            aria-label="Stop scenario run"
          >
            <Square className="h-4 w-4 shrink-0" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-snug">
          Stop scenario run
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
              "bg-muted hover:bg-muted",
            )}
            disabled
            aria-label="Auto Run scenario-events upon page refresh is temporarily forced on"
          >
            <AutoRunCircle className="h-4 w-4 shrink-0" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-snug">
          Auto Run on refresh is temporarily forced on.
        </TooltipContent>
      </Tooltip>
    </>
  );
}
