'use client';

import type { EventSequenceStep } from "@/types";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "../core/eventSequenceState";
import { EventSequenceStepItem } from "./EventSequenceStepItem";
import { useEventsRuntime } from "./EventsContext";

export function EventSequencePanel() {
  const { isCreatorContext, selectedScenarioId, selectedScenarioSequence } = useScenarioContext();
  const { creatorPreviewInteractive, isSequencePanelOpen, sequenceRuntime } = useEventsRuntime();

  if (!selectedScenarioId) {
    return null;
  }

  if (
    !(isSequencePanelOpen || sequenceRuntime.recordingMode !== "idle" || selectedScenarioSequence.length > 0)
  ) {
    return null;
  }

  const timelineSteps = selectedScenarioSequence.filter((step) => step.showInTimeline !== false);
  const hasSteps = timelineSteps.length > 0;
  const recording = sequenceRuntime.recordingMode !== "idle";
  const shouldRender = isCreatorContext ? (recording || hasSteps) : true;

  if (!shouldRender) {
    return null;
  }

  const displaySteps: Array<Pick<EventSequenceStep, "id" | "label" | "instruction" | "eventType" | "targetSummary">> = [
    {
      id: INITIAL_EVENT_SEQUENCE_STEP_ID,
      label: "Initial state",
      instruction: "View before any events are triggered.",
      eventType: "click",
      targetSummary: "initial state",
    },
    ...timelineSteps,
  ];

  return (
    <div className="flex flex-none justify-center px-3">
      <div
        className="mb-3 w-full max-w-[min(100%,720px)]"
        data-tour-spot="gameboard.events_strip"
      >
        <TooltipProvider>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <h3 className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
              Events
            </h3>
            {displaySteps.map((step, index) => (
              <EventSequenceStepItem key={step.id} step={step} stepIndex={index} />
            ))}
            {!hasSteps ? (
              <div className="text-sm text-muted-foreground">
                {isCreatorContext
                  ? creatorPreviewInteractive
                    ? "Use the Events panel in the sidebar to record the intended event sequence."
                    : "Switch to live preview to start recording an event sequence."
                  : "No event sequence has been recorded for this scenario."}
              </div>
            ) : null}
          </div>
        </TooltipProvider>

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
