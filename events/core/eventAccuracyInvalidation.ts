import { useArtboardReplayRuntimeStore } from "@/events/core/artboardReplayRuntimeStore";
import { getEventSequenceScenarioUiKey } from "@/events/core/eventSequenceState";
import { useEventSequenceCaptureStore } from "@/events/core/eventSequenceAccuracyStore";
import type { Level } from "@/types";

export function getScenarioAccuracyFingerprint(level: Level, scenarioId: string): string {
  const scenario = level.scenarios.find((candidate) => candidate.scenarioId === scenarioId);
  const scenarioSequence = level.eventSequence?.byScenarioId?.[scenarioId] ?? [];
  return [
    level.code.css ?? "",
    level.code.html ?? "",
    level.code.js ?? "",
    scenario?.js ?? "",
    level.solution?.css ?? "",
    level.solution?.html ?? "",
    level.solution?.js ?? "",
    JSON.stringify(scenarioSequence),
  ].join("\0");
}

export function invalidateScenarioAccuracyForContentChange(input: {
  level: Level;
  levelId: number;
  scenarioId: string;
}): void {
  const runtimeKey = getEventSequenceScenarioUiKey(input.levelId, input.scenarioId);
  useEventSequenceCaptureStore.getState().bumpDrawingVersion(runtimeKey);

  const stepIds = input.level.eventSequence?.byScenarioId?.[input.scenarioId]?.map((step) => step.id) ?? [];
  if (stepIds.length === 0) {
    return;
  }

  const replayStore = useArtboardReplayRuntimeStore.getState();
  stepIds.forEach((stepId) => {
    (["drawing", "solution"] as const).forEach((board) => {
      replayStore.setBoardStepFreshness(runtimeKey, board, stepId, (current) => ({
        ...current,
        isStale: true,
      }));
    });
  });
}
