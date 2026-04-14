'use client';

import { AlertTriangle, X } from "lucide-react";
import {
  ACCESS_CLOSE_FINAL_COUNTDOWN_MS,
  formatAccessCountdown,
} from "@/components/game-access/countdownFormat";

export function GameClosingCountdownNotice({
  remainingMs,
  onDismiss,
}: {
  remainingMs: number;
  onDismiss: () => void;
}) {
  const isFinalCountdown = remainingMs <= ACCESS_CLOSE_FINAL_COUNTDOWN_MS;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1200] flex w-[min(22rem,calc(100vw-2rem))] justify-end">
      <div
        className={`pointer-events-auto relative rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md ${
          isFinalCountdown
            ? "border-red-500/50 bg-red-500/12 text-red-950 dark:text-red-50"
            : "border-amber-500/40 bg-background/92 text-foreground"
        }`}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          aria-label="Dismiss access window countdown"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div
            className={`mt-0.5 rounded-full p-2 ${
              isFinalCountdown ? "bg-red-500/18 text-red-700 dark:text-red-200" : "bg-amber-500/15 text-amber-700 dark:text-amber-200"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {isFinalCountdown ? "Game access closing now" : "Game access ends soon"}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-[0.14em]">
              {formatAccessCountdown(remainingMs)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isFinalCountdown
                ? "This access window is about to close."
                : "Dismiss if it gets in the way. It stays hidden for this window."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
