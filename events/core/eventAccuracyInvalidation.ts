import { useArtboardReplayRuntimeStore } from "@/events/core/artboardReplayRuntimeStore";
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceState";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceAccuracyStore";
import type { Level } from "@/types";

function getScenarioSequenceFingerprint(level: Level, scenarioId: string): string {
  return JSON.stringify(level.eventSequence?.byScenarioId?.[scenarioId] ?? []);
}

export function getScenarioDrawingFingerprint(level: Level, scenarioId: string): string {
  const scenario = level.scenarios.find((candidate) => candidate.scenarioId === scenarioId);
  return [
    level.code.css ?? "",
    level.code.html ?? "",
    level.code.js ?? "",
    scenario?.js ?? "",
    getScenarioSequenceFingerprint(level, scenarioId),
  ].join("\0");
}

export function getScenarioSolutionFingerprint(level: Level, scenarioId: string): string {
  const scenario = level.scenarios.find((candidate) => candidate.scenarioId === scenarioId);
  return [
    level.solution?.css ?? "",
    level.solution?.html ?? "",
    level.solution?.js ?? "",
    scenario?.js ?? "",
    getScenarioSequenceFingerprint(level, scenarioId),
  ].join("\0");
}

export function getScenarioAccuracyFingerprint(level: Level, scenarioId: string): string {
  return [
    getScenarioDrawingFingerprint(level, scenarioId),
    getScenarioSolutionFingerprint(level, scenarioId),
  ].join("\0");
}

export function invalidateScenarioAccuracyForContentChange(input: {
  changedBoards?: {
    drawing: boolean;
    solution: boolean;
  };
  level: Level;
  levelId: number;
  scenarioId: string;
}): void {
  const runtimeKey = getEventSequenceScenarioUiKey(input.levelId, input.scenarioId);
  useEventSequenceCaptureStore.getState().bumpDrawingVersion(runtimeKey);
  const changedBoards = input.changedBoards ?? { drawing: true, solution: true };

  const stepIds = input.level.eventSequence?.byScenarioId?.[input.scenarioId]?.map((step) => step.id) ?? [];
  if (stepIds.length === 0) {
    return;
  }

  const replayStore = useArtboardReplayRuntimeStore.getState();
  stepIds.forEach((stepId) => {
    (["drawing", "solution"] as const).forEach((board) => {
      if (!changedBoards[board]) {
        return;
      }
      replayStore.setBoardStepFreshness(runtimeKey, board, stepId, (current) => ({
        ...current,
        isStale: true,
      }));
    });
  });
}
