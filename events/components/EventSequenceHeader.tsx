'use client';

import { useScenarioContext } from "@/scenario/ScenarioContext";


export function EventSequenceHeader() {
  const { replayHeaderState } = useScenarioContext();

  const title = replayHeaderState.mode === "stale" ? replayHeaderState.label : "Events";

  return (
    <header className="mb-2 flex min-h-6 items-center justify-center text-center">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
    </header>
  );
}
