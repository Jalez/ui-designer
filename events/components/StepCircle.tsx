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
  accuracyText,
}: StepCircleProps) {
  const staleRing = stale && !comparisonFailed;
  const accuracySlotText = loading ? "..." : (accuracyText ?? "");
  const showAccuracySlot = loading || Boolean(accuracyText);

  return (
    <div
      className={cn(
        "relative flex h-11 min-w-11 max-w-[18rem] items-center justify-center rounded-full border px-3 text-xs font-semibold transition-colors",
        comparisonFailed
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : completed
            ? "border-emerald-500 bg-emerald-500 text-white"
            : active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground",
        staleRing && "ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background dark:ring-amber-400/60",
        staleRing ? "opacity-90" : "",
      )}
      aria-busy={loading || undefined}
      aria-label={loading ? "Measuring accuracy" : compactLabel}
    >
      {loading ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full border-2",
            active
              ? "border-primary-foreground/80 shadow-[0_0_0_1px_rgba(255,255,255,0.22),0_0_8px_rgba(255,255,255,0.14)]"
              : "border-primary/70 shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_0_8px_rgba(59,130,246,0.12)]",
            "opacity-100 transition-opacity duration-300",
          )}
        />
      ) : null}
      <div className="flex items-center justify-center gap-1.5">
        <Icon className="h-4 w-4 shrink-0 sm:hidden" />
        <span className="hidden max-w-full truncate sm:inline">
          {label}
        </span>
        <span
          className={cn(
            "hidden shrink-0 text-[10px] font-medium md:inline",
            "min-w-[3.5rem] text-left tabular-nums",
            showAccuracySlot ? "opacity-90" : "opacity-0",
          )}
        >
          • {accuracySlotText || "0.00%"}
        </span>
      </div>
    </div>
  );
}
