'use client';

import { Fragment, useMemo } from "react";
import type { EventSequenceStep } from "@/types";
import { useScenarioContext } from "@/scenario/ScenarioContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EventSequenceHeader } from "./EventSequenceHeader";
import { EventSequenceStepItem } from "./EventSequenceStepItem";
import { ReplayDiagnosticMarker } from "./ReplayDiagnosticMarker";
import { useGameContext } from "@/components/ArtBoards/GameContext";
import { useReplayDiagnosticGroups } from "@/events/hooks/useReplayDiagnosticGroups";
import { useReplayDiagnosticToast } from "@/events/hooks/useReplayDiagnosticToast";

export function EventSequencePanel() {
  const { isCreatorRoute } = useGameContext();
  const { showLive } = useGameContext();
  const {
    isSequencePanelOpen,
    replayDiagnostics,
    selectedScenarioId,
    selectedScenarioSequence,
    sequenceRuntime,
  } = useScenarioContext();

  const timelineSteps = selectedScenarioSequence.filter((step) => step.showInTimeline !== false);
  const hasSteps = timelineSteps.length > 0;
  const recording = sequenceRuntime.recordingMode !== "idle";
  const shouldRender = isCreatorRoute ? (recording || hasSteps) : true;
  const displaySteps: Array<Pick<EventSequenceStep, "id" | "instruction" | "eventType" | "targetSummary" | "isInitial">> = useMemo(
    () => timelineSteps,
    [timelineSteps],
  );
  const {
    replayDiagnosticSummary,
    replayDiagnosticGroupsByBeforeStepId,
    runningReplayDiagnosticSummary,
    trailingReplayDiagnosticGroup,
  } = useReplayDiagnosticGroups({
    selectedScenarioSequence,
    replayDiagnostics,
  });

  useReplayDiagnosticToast({
    activeSignature: replayDiagnostics.activeSignature,
    startedAt: replayDiagnostics.startedAt,
    runningReplayDiagnosticSummary,
  });

  if (!selectedScenarioId) {
    return null;
  }

  if (
    !(isSequencePanelOpen || sequenceRuntime.recordingMode !== "idle" || selectedScenarioSequence.length > 0)
  ) {
    return null;
  }

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="flex flex-none justify-center px-3">
      <div
        className="events-strip-panel mb-3 w-full max-w-[min(100%,920px)] [container-type:inline-size]"
        data-tour-spot="gameboard.events_strip"
      >
        <EventSequenceHeader />
        <TooltipProvider>
          {hasSteps ? (
            <div className="overflow-hidden">
              <div className="flex justify-center">
                <div className="events-strip-row flex flex-nowrap items-center justify-center gap-3">
                  {displaySteps.map((step, index) => (
                    <Fragment key={step.id}>
                      {index > 0 ? (
                        replayDiagnosticGroupsByBeforeStepId.has(step.id) ? (
                          <ReplayDiagnosticMarker group={replayDiagnosticGroupsByBeforeStepId.get(step.id)!} />
                        ) : (
                          <span
                            aria-hidden
                            className="block h-px w-4 shrink-0 bg-border/70 max-[420px]:w-3"
                          />
                        )
                      ) : null}
                      <EventSequenceStepItem
                        step={step}
                        stepIndex={index}
                        displayMode="auto"
                      />
                    </Fragment>
                  ))}
                  {trailingReplayDiagnosticGroup ? (
                    <ReplayDiagnosticMarker group={trailingReplayDiagnosticGroup} />
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">
              {isCreatorRoute
                ? showLive
                  ? "Use the Events panel in the sidebar to record the intended event sequence."
                  : "Switch to live preview to start recording an event sequence."
                : "No event sequence has been recorded for this scenario."}
            </div>
          )}
        </TooltipProvider>
        {replayDiagnosticSummary ? (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            {replayDiagnosticSummary}
          </div>
        ) : null}

      </div>
    </div>
  );
}
