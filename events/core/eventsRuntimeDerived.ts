import {
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  getStepAccuracyValue,
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
  for (const stepId of Object.keys(sequenceRuntime.stepAccuraciesByStepId)) {
    if (isStepStale(sequenceRuntime, stepId)) {
      set.add(stepId);
    }
  }
  return set;
}

export function resolveFocusedGameStepId(params: {
  isCreatorContext: boolean;
  isSequencePanelOpen: boolean;
  selectedSequenceStepId: string | null;
  scenarioSequence: { id: string }[];
  activeIndex: number;
}): string | null {
  const {
    isCreatorContext,
    isSequencePanelOpen,
    selectedSequenceStepId,
    scenarioSequence,
    activeIndex,
  } = params;
  const effectiveSelectedStepId = resolveEffectiveSelectedSequenceStepId(
    isCreatorContext,
    isSequencePanelOpen,
    selectedSequenceStepId,
  );
  return effectiveSelectedStepId ?? resolveGameActiveStepId(isCreatorContext, scenarioSequence, activeIndex);
}

export function resolveCanonicalStepId(params: {
  selectedSequenceStepId: string | null | undefined;
  isCreatorContext: boolean;
  scenarioSequence: { id: string }[];
  activeIndex: number;
}): string {
  const selectedStepId = params.selectedSequenceStepId?.trim() || null;
  return selectedStepId
    ?? resolveGameActiveStepId(params.isCreatorContext, params.scenarioSequence, params.activeIndex)
    ?? INITIAL_EVENT_SEQUENCE_STEP_ID;
}

export function getMeasuredStepAccuracy(
  sequenceRuntime: SequenceRuntimeState,
  stepId: string,
): number | null {
  return getStepAccuracyValue(sequenceRuntime, stepId);
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
