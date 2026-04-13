import {
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  isStepStale,
  type EventSequenceRecordingMode,
  type SequenceRuntimeState,
} from "./eventSequenceState";

export function resolveEffectiveSelectedSequenceStepId(
  isCreatorContext: boolean,
  isSequencePanelOpen: boolean,
  selectedSequenceStepId: string | null,
): string | null {
  if (isCreatorContext && isSequencePanelOpen) {
    return selectedSequenceStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID;
  }
  return selectedSequenceStepId;
}

export function resolveGameActiveStepId(
  isCreatorContext: boolean,
  scenarioSequence: { id: string }[],
  activeIndex: number,
): string | null {
  if (isCreatorContext || scenarioSequence.length === 0) {
    return null;
  }
  const idx = clampActiveStepIndex(activeIndex, scenarioSequence.length);
  return scenarioSequence[idx]?.id ?? null;
}

export function collectStaleStepIds(sequenceRuntime: SequenceRuntimeState): Set<string> {
  const set = new Set<string>();
  for (const stepId of Object.keys(sequenceRuntime.stepAccuracyVersions)) {
    if (isStepStale(sequenceRuntime, stepId)) {
      set.add(stepId);
    }
  }
  return set;
}

export function clampActiveStepIndex(activeIndex: number, sequenceLength: number): number {
  return activeIndex >= sequenceLength ? 0 : activeIndex;
}

export function computeShowEventRunControls(
  selectedScenarioId: string | null,
  sequenceLength: number,
  recordingMode: EventSequenceRecordingMode,
  selectedRuntimeKey: string | null,
): boolean {
  return Boolean(selectedScenarioId)
    && sequenceLength > 0
    && recordingMode === "idle"
    && Boolean(selectedRuntimeKey);
}
