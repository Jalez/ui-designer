'use client';

import type { EventSequenceStep } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CircleDot, Keyboard, MousePointerClick, PenLine, Send, SlidersHorizontal } from "lucide-react";
import { useEventsActions, useEventsState } from "@/events/components/EventsContext";
import { StepCircle } from "./StepCircle";

/** Show up to two decimal places; trim trailing zeros (e.g. 87.4% not 87.40%). */
function formatStepAccuracyPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "--";
  }

  return `${parseFloat(value.toFixed(2))}%`;
}

function getStepIcon(step: Pick<EventSequenceStep, "eventType"> | { eventType: "click" }) {
  switch (step.eventType) {
    case "input":
      return PenLine;
    case "change":
      return SlidersHorizontal;
    case "submit":
      return Send;
    case "keydown":
      return Keyboard;
    case "click":
    default:
      return MousePointerClick;
  }
}

export type EventSequenceStepDisplay = Pick<
  EventSequenceStep,
  "id" | "instruction" | "eventType" | "targetSummary" | "isInitial"
>;

type EventSequenceStepItemProps = {
  step: EventSequenceStepDisplay;
  stepIndex: number;
  displayMode?: "full" | "compact" | "auto";
};

export function EventSequenceStepItem({ step, stepIndex, displayMode = "full" }: EventSequenceStepItemProps) {
  const { selectedStepId, stepsById } = useEventsState();
  const { selectStep } = useEventsActions();

  const isInitialStep = step.isInitial === true;
  const stepState = stepsById[step.id];
  const loading = stepState?.loading ?? false;
  const comparisonFailed = stepState?.comparisonFailed ?? false;
  const measured = stepState?.measured ?? false;
  const percent = stepState?.percent ?? 0;
  const stale = stepState?.accuracyStale ?? false;
  const accuracyText = stepState?.accuracyText ?? null;

  const title = isInitialStep ? "Initial state" : step.instruction;
  const Icon = isInitialStep ? CircleDot : getStepIcon(step);
  const compactLabel = isInitialStep
    ? "Initial state"
    : step.targetSummary?.trim() || step.instruction;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 rounded-full bg-transparent p-0 transition-none"
          aria-label={
            measured && stale && !loading
              ? `Event ${stepIndex + 1}, out of date — select to refresh accuracy`
              : `Event ${stepIndex + 1}`
          }
          onClick={() => selectStep(step.id)}
        >
          <StepCircle
            active={step.id === selectedStepId}
            completed={percent === 100}
            loading={loading}
            stale={stale}
            comparisonFailed={comparisonFailed}
            label={isInitialStep ? "Initial state" : step.instruction}
            icon={Icon}
            compactLabel={compactLabel}
            displayMode={displayMode}
            accuracyText={accuracyText}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px]">
        <div className="text-sm font-medium">{title}</div>
        {loading ? (
          <p className="mt-1.5 text-xs text-muted-foreground">Measuring accuracy for this event…</p>
        ) : comparisonFailed ? (
          <p className="mt-1.5 text-xs text-destructive">
            Could not compare this event to your design. Try again or check the preview.
          </p>
        ) : measured ? (
          <p className="mt-1.5 text-xs">
            <span className="text-muted-foreground">Accuracy: </span>
            <span className="font-medium tabular-nums">{formatStepAccuracyPercent(percent)}</span>
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            No accuracy yet — select this event to measure against your design.
          </p>
        )}
        {measured && stale && !loading ? (
          <p className="mt-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
            Out of date: your code, solution, or sequence changed after this was measured. Select the event
            again to refresh.
          </p>
        ) : null}
        <p className="mt-1.5 text-xs text-muted-foreground">{step.instruction}</p>
      </TooltipContent>
    </Tooltip>
  );
}
