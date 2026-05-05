'use client';

import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type StepCircleProps = {
  active: boolean;
  completed: boolean;
  loading: boolean;
  /** Accuracy was measured against an older drawing / source version. */
  stale: boolean;
  /** Comparison could not produce a result for this event. */
  comparisonFailed: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  compactLabel: string;
  displayMode?: "full" | "compact" | "auto";
  /** Optional short accuracy text shown next to the event label on wider layouts. */
  accuracyText?: string | null;
};

export function StepCircle({
  active,
  completed,
  loading,
  stale,
  comparisonFailed,
  label,
  icon: Icon,
  compactLabel,
  displayMode = "full",
  accuracyText,
}: StepCircleProps) {
  const showStaleOverlay = stale && !comparisonFailed && !active;
  /** Never show a loading placeholder in the pill — it caused layout flicker next to the icon */
  const accuracySlotText = accuracyText ?? "";
  const showAccuracySlot = Boolean(accuracyText);
  const isAutoLayout = displayMode === "auto";
  const showFullLabel = displayMode === "full" || isAutoLayout;
  /** Keep primary highlight for the focused step even while accuracy is pending (-1), so the strip matches selection and auto-run immediately */
  const showActiveHighlight = active;
  const baseStateClasses = showActiveHighlight
    ? "border-primary bg-primary text-primary-foreground"
    : comparisonFailed
      ? "border-red-400 bg-red-50 text-red-500 dark:bg-red-950"
      : completed
        ? "border-emerald-500 bg-emerald-500 text-foreground"
        : "border-border bg-background text-foreground";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-none",
        isAutoLayout && "events-step-circle-auto",
        showFullLabel
          ? "h-11 w-[11rem] max-w-[11rem] justify-start px-3"
          : "h-11 w-11 px-0",
        showStaleOverlay
          ? "border-amber-500 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-50"
          : baseStateClasses,
      )}
      aria-busy={loading || undefined}
      aria-label={loading ? "Measuring accuracy" : compactLabel}
    >
      {showStaleOverlay ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-dashed border-amber-600 dark:border-amber-300"
        />
      ) : null}
      <div className={cn(
        "relative z-10 flex min-w-0 items-center gap-1.5",
        showFullLabel ? "w-full justify-start" : "justify-center",
        isAutoLayout && "events-step-circle-content-auto",
      )}>
        <Icon className="h-4 w-4 shrink-0" />
        <span className={cn(
          "min-w-0 max-w-full truncate",
          showFullLabel ? "inline" : "hidden",
          isAutoLayout && "events-step-circle-label-auto",
        )}>
          {label}
        </span>
        <span
          className={cn(
            "hidden shrink-0 text-[10px] font-medium",
            "min-w-[3.5rem] text-left tabular-nums",
            showFullLabel && "2xl:inline",
            showAccuracySlot ? "opacity-90" : "opacity-0",
            isAutoLayout && "events-step-circle-accuracy-auto",
          )}
        >
          • {accuracySlotText || "0.00%"}
        </span>
      </div>
    </div>
  );
}
