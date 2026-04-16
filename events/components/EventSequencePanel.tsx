'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { EventSequenceStep } from "@/types";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  deriveReplayDiagnosticGroups,
  summarizeRunningReplayDiagnosticGroup,
  summarizeReplayDiagnosticGroups,
  summarizeReplayDiagnosticSegments,
} from "../core/replayDiagnostics";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "../core/eventSequenceState";
import { EventSequenceStepItem } from "./EventSequenceStepItem";
import { ReplayDiagnosticMarker } from "./ReplayDiagnosticMarker";
import { useEventsRuntime } from "./EventsContext";

const FULL_STEP_WIDTH_PX = 176;
const COMPACT_STEP_WIDTH_PX = 44;
const ROW_GAP_PX = 12;
const MIN_TINY_SCALE = 0.76;
const REPLAY_DIAGNOSTIC_TOAST_ID = "events-replay-diagnostic";
const REPLAY_DIAGNOSTIC_TOAST_DELAY_MS = 1500;

function estimateReplayDiagnosticMarkerWidth(segmentCount: number): number {
  return 18 + (segmentCount * 10) + Math.max(0, segmentCount - 1) * 4;
}

export function EventSequencePanel() {
  const { isCreatorContext, selectedScenarioId, selectedScenarioSequence } = useScenarioContext();
  const {
    creatorPreviewInteractive,
    isSequencePanelOpen,
    replayDiagnostics,
    sequenceRuntime,
  } = useEventsRuntime();
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const node = layoutRef.current;
    if (!node || typeof ResizeObserver === "undefined") {
      return;
    }

    const update = () => {
      setAvailableWidth(node.clientWidth);
    };

    update();
    const observer = new ResizeObserver(() => update());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  const markerSequence = useMemo(
    () => displaySteps.flatMap((step, index) => (
      index > 0 && replayDiagnosticGroupsByBeforeStepId.has(step.id)
        ? [replayDiagnosticGroupsByBeforeStepId.get(step.id)!]
        : []
    )).concat(trailingReplayDiagnosticGroup ? [trailingReplayDiagnosticGroup] : []),
    [displaySteps, replayDiagnosticGroupsByBeforeStepId, trailingReplayDiagnosticGroup],
  );

  const replayMarkerWidths = useMemo(() => {
    const widths = new Map<string, number>();
    markerSequence.forEach((group) => {
      widths.set(group.id, estimateReplayDiagnosticMarkerWidth(Math.max(1, summarizeReplayDiagnosticSegments(group).length)));
    });
    return widths;
  }, [markerSequence]);

  const fullRowWidth = useMemo(() => {
    const markerWidth = markerSequence.reduce(
      (sum, group) => sum + (replayMarkerWidths.get(group.id) ?? estimateReplayDiagnosticMarkerWidth(1)),
      0,
    );
    const itemCount = displaySteps.length + markerSequence.length;
    return (displaySteps.length * FULL_STEP_WIDTH_PX) + markerWidth + (Math.max(0, itemCount - 1) * ROW_GAP_PX);
  }, [displaySteps.length, markerSequence, replayMarkerWidths]);

  const compactRowWidth = useMemo(() => {
    const markerWidth = markerSequence.reduce(
      (sum, group) => sum + (replayMarkerWidths.get(group.id) ?? estimateReplayDiagnosticMarkerWidth(1)),
      0,
    );
    const itemCount = displaySteps.length + markerSequence.length;
    return (displaySteps.length * COMPACT_STEP_WIDTH_PX) + markerWidth + (Math.max(0, itemCount - 1) * ROW_GAP_PX);
  }, [displaySteps.length, markerSequence, replayMarkerWidths]);

  const layoutMode: "full" | "compact" | "tiny" = availableWidth === 0 || availableWidth >= fullRowWidth
    ? "full"
    : availableWidth >= compactRowWidth
      ? "compact"
      : "tiny";

  const compactScale = layoutMode === "tiny" && compactRowWidth > 0
    ? Math.max(MIN_TINY_SCALE, Math.min(1, availableWidth / compactRowWidth))
    : 1;

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
        ref={layoutRef}
        className="mb-3 w-full max-w-[min(100%,920px)]"
        data-tour-spot="gameboard.events_strip"
      >
        <div className="mb-2 text-center text-sm font-semibold tracking-tight text-foreground">
          Events
        </div>
        <TooltipProvider>
          {hasSteps ? (
            <div className="overflow-hidden">
              <div className="flex justify-center">
                <div
                  className="origin-center"
                  style={layoutMode === "tiny" ? { transform: `scale(${compactScale})` } : undefined}
                >
                  <div className="flex flex-nowrap items-center justify-center gap-3">
                    {displaySteps.map((step, index) => (
                      <Fragment key={step.id}>
                        {index > 0 && replayDiagnosticGroupsByBeforeStepId.has(step.id) ? (
                          <ReplayDiagnosticMarker group={replayDiagnosticGroupsByBeforeStepId.get(step.id)!} />
                        ) : null}
                        <EventSequenceStepItem
                          step={step}
                          stepIndex={index}
                          displayMode={layoutMode === "full" ? "full" : "compact"}
                        />
                      </Fragment>
                    ))}
                    {trailingReplayDiagnosticGroup ? (
                      <ReplayDiagnosticMarker group={trailingReplayDiagnosticGroup} />
                    ) : null}
                  </div>
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
