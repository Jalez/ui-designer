"use client";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AutoRunCircle } from "@/components/icons/AutoRunCircle";
import { cn } from "@/lib/utils/cn";
import { Play, Square } from "lucide-react";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import { useSequenceReplayStore } from "../core/sequenceReplayStore";

export function ScenarioEventRunButtons() {
  const {
    autoReplayOnMount,
    autoReplayQueued,
    handleSetScenarioAutoReplay,
    handleStartScenarioEventRun,
    handleStopScenarioEventRun,
    hasFreshSequenceAccuracy,
    shouldPromptReplayRerun,
    shouldShakeManualRun,
    showEventRunControls,
  } = useScenarioContext();
  const isRunning = useSequenceReplayStore((state) => state.isRunning);

  const isQueued = autoReplayQueued && !isRunning;

  if (!showEventRunControls) {
    return null;
  }

  return (
    <>
       {!isRunning ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 shrink-0 border-0 shadow-none",
              isQueued && "bg-muted hover:bg-muted/90",
              shouldShakeManualRun && "animate-shake-burst",
            )}
            onClick={handleStartScenarioEventRun}
            disabled={isRunning || isQueued}
            aria-label={
              isQueued
                ? "Preparing scenario run"
                : shouldPromptReplayRerun
                  ? "Re-run events to update accuracy"
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
            : shouldPromptReplayRerun
              ? "Re-run events to update accuracy."
            : hasFreshSequenceAccuracy
              ? "Re-run through every event in order, even if nothing has changed."
              : "Run through each scenario event in order."}
        </TooltipContent>
      </Tooltip>
    ) : (

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
          )}
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
            onClick={() => handleSetScenarioAutoReplay(!autoReplayOnMount)}
            aria-pressed={autoReplayOnMount}
            aria-label={autoReplayOnMount ? "Disable automatic event checks" : "Enable automatic event checks"}
          >
            <AutoRunCircle className={cn("h-4 w-4 shrink-0", !autoReplayOnMount && "opacity-45")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-snug">
          {autoReplayOnMount
            ? "Auto Run is on. Event checks run after refresh and stale content changes."
            : "Auto Run is off. Use the play button to run event checks manually."}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
