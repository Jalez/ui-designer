'use client';

import { TriangleAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import {
  summarizeReplayDiagnosticSegments,
  type ReplayDiagnosticGroup,
  type ReplayDiagnosticSegment,
} from "@/events/core/replayDiagnostics";

type ReplayDiagnosticMarkerProps = {
  group: ReplayDiagnosticGroup;
};

/** Match selected step chip: border-primary bg-primary (see StepCircle showActiveHighlight) */
function getSegmentClasses(segment: ReplayDiagnosticSegment): string {
  switch (segment.state) {
    case "completed":
      return "border-emerald-600 bg-emerald-500";
    case "skipped":
      return "border-red-600 bg-red-500";
    case "running":
      return "border-primary bg-primary";
    case "pending":
      return "border-primary/55 bg-primary/35";
    case "idle":
    default:
      return "border-muted-foreground/30 bg-muted-foreground/25";
  }
}

function getTooltipTitle(group: ReplayDiagnosticGroup): string {
  if (group.hiddenSteps.length === 1) {
    return "Replay-only event";
  }
  return `${group.hiddenSteps.length} replay-only events`;
}

function getTooltipMessage(group: ReplayDiagnosticGroup): string {
  const selector = group.activeDiagnostic?.selector?.trim();
  switch (group.state) {
    case "running":
      return selector
        ? `Waiting for selector ${selector} before replay can continue.`
        : "Replay is currently processing this replay-only event.";
    case "skipped":
      return selector
        ? `Replay skipped selector ${selector} because it was not found.`
        : "Replay skipped this replay-only event because its target was not found.";
    case "completed":
      return "Replay completed these replay-only events.";
    case "idle":
    default:
      return "These replay-only events run between the visible scored events but do not receive their own accuracy score.";
  }
}

function connectorLineClass(group: ReplayDiagnosticGroup): string {
  if (group.state === "skipped") {
    return "bg-red-500/40";
  }
  if (group.state === "completed") {
    return "bg-emerald-500/35";
  }
  if (group.hasActiveReplay || group.state === "running") {
    return "bg-primary/45";
  }
  return "bg-border/70";
}

export function ReplayDiagnosticMarker({ group }: ReplayDiagnosticMarkerProps) {
  const summaryItems = summarizeReplayDiagnosticSegments(group);
  const lineClass = connectorLineClass(group);
  const visibleSegments = summaryItems.length > 0 ? summaryItems : [{
    id: `${group.id}:fallback`,
    label: "Replay-only events",
    detail: null,
    stepCount: group.hiddenSteps.length,
    selector: null,
    state: group.state === "running" ? "running" : group.state === "skipped" ? "skipped" : group.state === "completed" ? "completed" : "idle",
    stepIds: group.hiddenSteps.map((step) => step.id),
  }];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex shrink-0 items-center gap-1 max-[420px]:gap-0.5 rounded-full transition-none",
            /* Same family as step chips: soft primary tint on the cluster; active segment uses solid primary (getSegmentClasses). */
            group.state === "running" && "bg-primary/15 px-1 py-0.5",
            group.hasActiveReplay && group.state !== "running" && "bg-primary/8 px-0.5 py-0.5",
          )}
          aria-label={getTooltipTitle(group)}
        >
          <span className={cn("block h-px w-4 max-[420px]:w-3", lineClass)} />
          <div className="inline-flex items-center gap-1 rounded-full px-0.5 py-0.5 max-[420px]:gap-0.5">
            {visibleSegments.map((segment) => (
              <span
                key={segment.id}
                className={cn(
                  "block h-2.5 w-2.5 rounded-full border transition-none shadow-sm max-[420px]:h-2 max-[420px]:w-2",
                  getSegmentClasses(segment),
                  segment.state === "running"
                    && "ring-2 ring-primary/55 ring-offset-1 ring-offset-background",
                  segment.stepCount > 1 && "w-4",
                  segment.stepCount > 1 && "max-[420px]:w-3",
                )}
                title={segment.label}
              />
            ))}
          </div>
          <span className={cn("block h-px w-4 max-[420px]:w-3", lineClass)} />
          {group.state === "skipped" ? (
            <TriangleAlert className="h-3 w-3 text-red-500" />
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        <div className="text-sm font-medium">{getTooltipTitle(group)}</div>
        <p className="mt-1.5 text-xs text-muted-foreground">{getTooltipMessage(group)}</p>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {visibleSegments.slice(0, 4).map((item) => (
            <div key={item.id}>
              <span className="font-medium text-foreground">{item.label}</span>
              {item.stepCount > 1 ? ` (${item.stepCount} replay-only events)` : ""}
              {item.detail ? `: ${item.detail}` : ""}
            </div>
          ))}
          {visibleSegments.length > 4 ? <div>…</div> : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
