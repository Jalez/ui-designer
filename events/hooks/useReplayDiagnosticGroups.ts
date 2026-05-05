"use client";

import { useMemo } from "react";
import type { EventSequenceStep } from "@/types";
import type { ReplayDiagnosticsState } from "@/events/core/eventSequenceReplayTypes";
import {
  deriveReplayDiagnosticGroups,
  summarizeReplayDiagnosticGroups,
  summarizeRunningReplayDiagnosticGroup,
} from "@/events/core/replayDiagnostics";

type UseReplayDiagnosticGroupsParams = {
  selectedScenarioSequence: EventSequenceStep[];
  replayDiagnostics: ReplayDiagnosticsState;
};

export function useReplayDiagnosticGroups({
  selectedScenarioSequence,
  replayDiagnostics,
}: UseReplayDiagnosticGroupsParams) {
  const replayDiagnosticGroups = useMemo(
    () => deriveReplayDiagnosticGroups(selectedScenarioSequence, replayDiagnostics),
    [selectedScenarioSequence, replayDiagnostics],
  );

  const replayDiagnosticSummary = useMemo(
    () => summarizeReplayDiagnosticGroups(replayDiagnosticGroups),
    [replayDiagnosticGroups],
  );

  const runningReplayDiagnosticSummary = useMemo(
    () => summarizeRunningReplayDiagnosticGroup(replayDiagnosticGroups),
    [replayDiagnosticGroups],
  );

  const replayDiagnosticGroupsByBeforeStepId = useMemo(
    () => new Map(
      replayDiagnosticGroups
        .filter((group) => group.beforeStepId !== null)
        .map((group) => [group.beforeStepId!, group]),
    ),
    [replayDiagnosticGroups],
  );

  const trailingReplayDiagnosticGroup = useMemo(
    () => replayDiagnosticGroups.find((group) => group.beforeStepId === null) ?? null,
    [replayDiagnosticGroups],
  );

  return {
    replayDiagnosticGroups,
    replayDiagnosticSummary,
    runningReplayDiagnosticSummary,
    replayDiagnosticGroupsByBeforeStepId,
    trailingReplayDiagnosticGroup,
  };
}
