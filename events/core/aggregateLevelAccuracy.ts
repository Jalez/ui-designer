import type { Level } from "@/types";
import {
  EMPTY_SCENARIO_ACCURACY_AGGREGATE,
  aggregateScenarioAccuracyFromCapture,
  type ScenarioAccuracyAggregate,
} from "./aggregateEventSequenceAccuracy";
import {
  selectCaptureState,
  type EventSequenceCaptureSlice,
} from "./eventSequenceCaptureStore";
import { getEventSequenceScenarioUiKey } from "./eventSequenceReplayTypes";

export type ScenarioAccuracyEntry = ScenarioAccuracyAggregate & {
  scenarioId: string;
  runtimeKey: string;
};

export type LevelAccuracyAggregate = {
  accuracy: number;
  meanKnown: boolean;
  stale: boolean;
  scenarios: ScenarioAccuracyEntry[];
};

export const EMPTY_LEVEL_ACCURACY_AGGREGATE: LevelAccuracyAggregate = {
  accuracy: 0,
  meanKnown: false,
  stale: false,
  scenarios: [],
};

export function aggregateLevelAccuracy(
  currentLevel: number,
  level: Level | undefined,
  captureByKey: Record<string, EventSequenceCaptureSlice>,
): LevelAccuracyAggregate {
  if (!level || !level.scenarios || level.scenarios.length === 0) {
    return EMPTY_LEVEL_ACCURACY_AGGREGATE;
  }

  const scenarios: ScenarioAccuracyEntry[] = level.scenarios.map((scenario) => {
    const runtimeKey = getEventSequenceScenarioUiKey(currentLevel, scenario.scenarioId);
    const capture = selectCaptureState(captureByKey, runtimeKey);
    const steps = level.eventSequence?.byScenarioId?.[scenario.scenarioId] ?? [];
    const agg = steps.length > 0
      ? aggregateScenarioAccuracyFromCapture(steps, capture)
      : EMPTY_SCENARIO_ACCURACY_AGGREGATE;
    return { ...agg, scenarioId: scenario.scenarioId, runtimeKey };
  });

  const meanKnown = scenarios.every((s) => s.meanKnown);
  const stale = scenarios.some((s) => s.stale);
  const accuracy = meanKnown
    ? Math.round((scenarios.reduce((acc, s) => acc + s.accuracy, 0) / scenarios.length) * 100) / 100
    : 0;

  return { accuracy, meanKnown, stale, scenarios };
}
