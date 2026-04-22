'use client';

import { useScenarioContext } from "@/scenario/ScenarioContext";


export function EventSequenceHeader() {
  const { replayHeaderState } = useScenarioContext();

  if (replayHeaderState.mode === "running" || replayHeaderState.mode === "completed") {
    return (
      <header className="mb-2 flex min-h-6 items-center justify-center">
        <progress
          className="h-1.5 w-full max-w-xs"
          value={replayHeaderState.percent}
          max={100}
          aria-label={replayHeaderState.label}
        />
        <output className="ml-2 text-xs font-medium text-muted-foreground">
          {replayHeaderState.label}
        </output>
      </header>
    );
  }

  const title = replayHeaderState.mode === "stale" ? replayHeaderState.label : "Events";

  return (
    <header className="mb-2 flex min-h-6 items-center justify-center text-center">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
    </header>
  );
}
