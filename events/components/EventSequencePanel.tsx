'use client';

import { Fragment, useEffect, useMemo } from "react";
import { toast } from "sonner";
import type { EventSequenceStep } from "@/types";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  deriveReplayDiagnosticGroups,
  summarizeRunningReplayDiagnosticGroup,
  summarizeReplayDiagnosticGroups,
} from "../core/replayDiagnostics";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "../core/eventSequenceState";
import { EventSequenceStepItem } from "./EventSequenceStepItem";
import { ReplayDiagnosticMarker } from "./ReplayDiagnosticMarker";
import { useEventsRuntime } from "./EventsContext";

const REPLAY_DIAGNOSTIC_TOAST_ID = "events-replay-diagnostic";
const REPLAY_DIAGNOSTIC_TOAST_DELAY_MS = 1500;

export function EventSequencePanel() {
  const { isCreatorContext, selectedScenarioId, selectedScenarioSequence } = useScenarioContext();
  const {
    creatorPreviewInteractive,
    isSequencePanelOpen,
    replayDiagnostics,
    sequenceRuntime,
  } = useEventsRuntime();

  const timelineSteps = selectedScenarioSequence.filter((step) => step.showInTimeline !== false);
  const hasSteps = timelineSteps.length > 0;
  const recording = sequenceRuntime.recordingMode !== "idle";
  const shouldRender = isCreatorContext ? (recording || hasSteps) : true;
  const displaySteps: Array<Pick<EventSequenceStep, "id" | "label" | "instruction" | "eventType" | "targetSummary">> = useMemo(() => [
    {
      id: INITIAL_EVENT_SEQUENCE_STEP_ID,
      label: "Initial state",
      instruction: "View before any events are triggered.",
      eventType: "click",
      targetSummary: "initial state",
    },
    ...timelineSteps,
  ], [timelineSteps]);
  const replayDiagnosticGroups = deriveReplayDiagnosticGroups(selectedScenarioSequence, replayDiagnostics);
  const replayDiagnosticSummary = summarizeReplayDiagnosticGroups(replayDiagnosticGroups);
  const runningReplayDiagnosticSummary = summarizeRunningReplayDiagnosticGroup(replayDiagnosticGroups);
  const replayDiagnosticGroupsByBeforeStepId = useMemo(() => new Map(
    replayDiagnosticGroups
      .filter((group) => group.beforeStepId !== null)
      .map((group) => [group.beforeStepId!, group]),
  ), [replayDiagnosticGroups]);
  const trailingReplayDiagnosticGroup =
    replayDiagnosticGroups.find((group) => group.beforeStepId === null) ?? null;

  useEffect(() => {
    if (!replayDiagnostics.activeSignature || !runningReplayDiagnosticSummary) {
      toast.dismiss(REPLAY_DIAGNOSTIC_TOAST_ID);
      return;
    }

    const startedAt = replayDiagnostics.startedAt ?? Date.now();
    const remainingDelay = Math.max(
      0,
      REPLAY_DIAGNOSTIC_TOAST_DELAY_MS - (Date.now() - startedAt),
    );
    const timeoutId = window.setTimeout(() => {
      toast.loading(runningReplayDiagnosticSummary, {
        id: REPLAY_DIAGNOSTIC_TOAST_ID,
      });
    }, remainingDelay);

    return () => window.clearTimeout(timeoutId);
  }, [
    replayDiagnostics.activeSignature,
    replayDiagnostics.startedAt,
    runningReplayDiagnosticSummary,
  ]);

  useEffect(() => (
    () => {
      toast.dismiss(REPLAY_DIAGNOSTIC_TOAST_ID);
    }
  ), []);

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
        <div className="mb-2 text-center text-sm font-semibold tracking-tight text-foreground">
          Events
        </div>
        <TooltipProvider>
          {hasSteps ? (
            <div className="overflow-hidden">
              <div className="flex justify-center">
                <div className="events-strip-row flex flex-nowrap items-center justify-center gap-3">
                  {displaySteps.map((step, index) => (
                    <Fragment key={step.id}>
                      {index > 0 && replayDiagnosticGroupsByBeforeStepId.has(step.id) ? (
                        <ReplayDiagnosticMarker group={replayDiagnosticGroupsByBeforeStepId.get(step.id)!} />
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
              {isCreatorContext
                ? creatorPreviewInteractive
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

        {sequenceRuntime.autoReplay?.running && sequenceRuntime.autoReplay.totalSteps > 0 ? (
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.round(
                    (sequenceRuntime.autoReplay.stepIndex / sequenceRuntime.autoReplay.totalSteps) * 100,
                  )}%`,
                }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              Running events {sequenceRuntime.autoReplay.stepIndex}/{sequenceRuntime.autoReplay.totalSteps}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
