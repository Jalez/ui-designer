import type { EventSequenceStep } from "@/types";
import type { ReplayDiagnosticsState, ReplayStepDiagnostic } from "./eventSequenceState";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "./eventSequenceState";

/**
 * While the iframe replays hidden (timeline-hidden) steps, the strip should
 * emphasize replay-only markers before the next visible step — use this to
 * suppress primary focus on visible chips until no hidden step is `running`.
 */
export function findRunningReplayOnlyStepId(
  fullSequence: EventSequenceStep[],
  replayDiagnostics: ReplayDiagnosticsState,
): string | null {
  if (!replayDiagnostics.activeSignature) {
    return null;
  }
  for (const [stepId, diag] of Object.entries(replayDiagnostics.stepStates)) {
    if (diag?.status !== "running") {
      continue;
    }
    const step = fullSequence.find((s) => s.id === stepId);
    if (step && step.showInTimeline === false) {
      return stepId;
    }
  }
  return null;
}

export type ReplayDiagnosticGroupState = "idle" | "running" | "skipped" | "completed";

export type ReplayDiagnosticGroup = {
  id: string;
  afterStepId: string;
  beforeStepId: string | null;
  hiddenSteps: EventSequenceStep[];
  state: ReplayDiagnosticGroupState;
  activeStepId: string | null;
  skippedCount: number;
  completedCount: number;
  activeDiagnostic: ReplayStepDiagnostic | null;
  diagnosticsByStepId: Record<string, ReplayStepDiagnostic | null>;
  hasActiveReplay: boolean;
};

export type ReplayDiagnosticSummaryItem = {
  id: string;
  label: string;
  detail: string | null;
  stepCount: number;
};

export type ReplayDiagnosticSegmentState =
  | "idle"
  | "pending"
  | "running"
  | "skipped"
  | "completed";

export type ReplayDiagnosticSegment = ReplayDiagnosticSummaryItem & {
  selector: string | null;
  state: ReplayDiagnosticSegmentState;
  stepIds: string[];
};

function getSnapshotFieldValue(step: EventSequenceStep): string | null {
  if (!step.selector || typeof DOMParser === "undefined") {
    return null;
  }
  try {
    const parsed = new DOMParser().parseFromString(step.snapshot.snapshotHtml, "text/html");
    const target = parsed.querySelector(step.selector);
    if (target instanceof HTMLInputElement) {
      if (target.type === "checkbox" || target.type === "radio") {
        return target.checked ? "checked" : "unchecked";
      }
      return target.value || null;
    }
    if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return target.value || null;
    }
  } catch {
    return null;
  }
  return null;
}

function getGroupState(
  hiddenSteps: EventSequenceStep[],
  replayDiagnostics: ReplayDiagnosticsState,
): Omit<ReplayDiagnosticGroup, "id" | "afterStepId" | "beforeStepId" | "hiddenSteps"> {
  const diagnosticsByStepId = Object.fromEntries(
    hiddenSteps.map((step) => [step.id, replayDiagnostics.stepStates[step.id] ?? null]),
  ) as Record<string, ReplayStepDiagnostic | null>;
  const diagnostics = hiddenSteps
    .map((step) => ({ stepId: step.id, diagnostic: diagnosticsByStepId[step.id] }))
    .filter((entry) => entry.diagnostic !== null) as Array<{ stepId: string; diagnostic: ReplayStepDiagnostic }>;
  const activeEntry = diagnostics.find((entry) => entry.diagnostic.status === "running") ?? null;
  const skippedCount = diagnostics.filter((entry) => entry.diagnostic.status === "skipped").length;
  const completedCount = diagnostics.filter((entry) => entry.diagnostic.status === "completed").length;
  const base = {
    diagnosticsByStepId,
    hasActiveReplay: Boolean(replayDiagnostics.activeSignature),
  };

  if (activeEntry) {
    return {
      ...base,
      state: "running",
      activeStepId: activeEntry.stepId,
      skippedCount,
      completedCount,
      activeDiagnostic: activeEntry.diagnostic,
    };
  }
  if (skippedCount > 0) {
    return {
      ...base,
      state: "skipped",
      activeStepId: null,
      skippedCount,
      completedCount,
      activeDiagnostic: diagnostics.find((entry) => entry.diagnostic.status === "skipped")?.diagnostic ?? null,
    };
  }
  if (completedCount > 0 && completedCount === hiddenSteps.length) {
    return {
      ...base,
      state: "completed",
      activeStepId: null,
      skippedCount,
      completedCount,
      activeDiagnostic: null,
    };
  }
  return {
    ...base,
    state: "idle",
    activeStepId: null,
    skippedCount,
    completedCount,
    activeDiagnostic: null,
  };
}

export function deriveReplayDiagnosticGroups(
  sequence: EventSequenceStep[],
  replayDiagnostics: ReplayDiagnosticsState,
): ReplayDiagnosticGroup[] {
  const groups: ReplayDiagnosticGroup[] = [];
  let afterStepId = INITIAL_EVENT_SEQUENCE_STEP_ID;
  let hiddenBuffer: EventSequenceStep[] = [];

  const pushGroup = (beforeStepId: string | null) => {
    if (hiddenBuffer.length === 0) {
      return;
    }
    groups.push({
      id: `${afterStepId}->${beforeStepId ?? "__end__"}`,
      afterStepId,
      beforeStepId,
      hiddenSteps: hiddenBuffer,
      ...getGroupState(hiddenBuffer, replayDiagnostics),
    });
    hiddenBuffer = [];
  };

  sequence.forEach((step) => {
    if (step.showInTimeline === false) {
      hiddenBuffer.push(step);
      return;
    }
    pushGroup(step.id);
    afterStepId = step.id;
  });

  pushGroup(null);
  return groups;
}

export function summarizeReplayDiagnosticGroups(groups: ReplayDiagnosticGroup[]): string | null {
  const skippedCount = groups.reduce((sum, group) => sum + group.skippedCount, 0);
  if (skippedCount > 0) {
    return skippedCount === 1
      ? "Replay skipped 1 replay-only event because its target was not found."
      : `Replay skipped ${skippedCount} replay-only events because their targets were not found.`;
  }

  return null;
}

export function summarizeRunningReplayDiagnosticGroup(
  groups: ReplayDiagnosticGroup[],
): string | null {
  const runningGroup = groups.find((group) => group.state === "running");
  if (runningGroup) {
    const selector = runningGroup.activeDiagnostic?.selector?.trim();
    return selector
      ? `Replay is waiting on replay-only event selector "${selector}".`
      : "Replay is processing replay-only events between visible steps.";
  }
  return null;
}

export function summarizeReplayDiagnosticGroupSteps(
  group: ReplayDiagnosticGroup,
): ReplayDiagnosticSummaryItem[] {
  return summarizeReplayDiagnosticSegments(group).map((item) => ({
    id: item.id,
    label: item.label,
    detail: item.detail,
    stepCount: item.stepCount,
  }));
}

function getSegmentState(
  stepIds: string[],
  group: ReplayDiagnosticGroup,
): ReplayDiagnosticSegmentState {
  if (
    group.state === "running"
    && group.activeStepId != null
    && stepIds.includes(group.activeStepId)
  ) {
    return "running";
  }

  const diagnostics = stepIds
    .map((stepId) => group.diagnosticsByStepId[stepId] ?? null)
    .filter((entry) => entry !== null) as ReplayStepDiagnostic[];

  if (diagnostics.some((entry) => entry.status === "running")) {
    return "running";
  }
  if (diagnostics.some((entry) => entry.status === "skipped")) {
    return "skipped";
  }
  if (diagnostics.length === stepIds.length && diagnostics.every((entry) => entry.status === "completed")) {
    return "completed";
  }
  if (group.hasActiveReplay) {
    return "pending";
  }
  return "idle";
}

export function summarizeReplayDiagnosticSegments(
  group: ReplayDiagnosticGroup,
): ReplayDiagnosticSegment[] {
  const items: ReplayDiagnosticSegment[] = [];

  group.hiddenSteps.forEach((step) => {
    const previous = items[items.length - 1] ?? null;
    const canCollapseIntoPrevious =
      previous
      && (step.eventType === "input" || step.eventType === "change")
      && Boolean(step.selector)
      && previous.selector === step.selector
      && previous.id.startsWith(`${step.eventType}:${step.selector ?? ""}`);

    if (canCollapseIntoPrevious) {
      const value = getSnapshotFieldValue(step);
      previous.stepCount += 1;
      previous.stepIds.push(step.id);
      previous.detail = value ? `Final value: "${value}"` : previous.detail;
      return;
    }

    const value = getSnapshotFieldValue(step);
    const target = step.targetSummary?.trim() || step.selector?.trim() || step.label;
    items.push({
      id: `${step.eventType}:${step.selector ?? step.id}:${items.length}`,
      label: target,
      detail:
        step.eventType === "input" || step.eventType === "change"
          ? value
            ? `Final value: "${value}"`
            : "Input replay"
          : step.label,
      stepCount: 1,
      selector: step.selector ?? null,
      state: "idle",
      stepIds: [step.id],
    });
  });

  return items.map((item) => ({
    ...item,
    state: getSegmentState(item.stepIds, group),
  }));
}
