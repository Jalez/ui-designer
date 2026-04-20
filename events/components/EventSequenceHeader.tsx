'use client';

import { useEventState } from "./EventContext";

export function EventSequenceHeader() {
  const { replayHeaderState } = useEventState();

  return (
    <div className="mb-2 flex min-h-6 items-center justify-center">
      {replayHeaderState.mode === "running" || replayHeaderState.mode === "completed" ? (
        <div className="flex w-full max-w-xs items-center justify-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${replayHeaderState.percent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {replayHeaderState.label}
          </span>
        </div>
      ) : replayHeaderState.mode === "stale" ? (
        <div className="text-center text-sm font-semibold tracking-tight text-foreground">
          {replayHeaderState.label}
        </div>
      ) : (
        <div className="text-center text-sm font-semibold tracking-tight text-foreground">
          Events
        </div>
      )}
    </div>
  );
}
