import type { EventSequenceRecordingMode } from "./eventSequenceReplayTypes";
import {
  getStepAccuracyValue,
  isStepStale,
  selectCaptureState,
  useEventSequenceCaptureStore,
} from "./eventSequenceAccuracyStore";

export function resolveEffectiveSelectedSequenceStepId(
  isCreatorRoute: boolean,
  isSequencePanelOpen: boolean,
  selectedSequenceStepId: string | null,
): string | null {
  if (isCreatorRoute && isSequencePanelOpen) {
    return selectedSequenceStepId ?? null;
  }
  return selectedSequenceStepId;
}

export function resolveGameActiveStepId(
  isCreatorRoute: boolean,
  scenarioSequence: { id: string }[],
  activeIndex: number,
): string | null {
  if (isCreatorRoute && scenarioSequence.length === 0) {
    return null;
  }
  const idx = clampActiveStepIndex(activeIndex, scenarioSequence.length);
  return scenarioSequence[idx]?.id ?? null;
}

export function collectStaleStepIds(runtimeKey: string): Set<string> {
  const capture = selectCaptureState(useEventSequenceCaptureStore.getState().captureByKey, runtimeKey);
  const set = new Set<string>();
  for (const stepId of Object.keys(capture.stepAccuraciesByStepId)) {
    if (isStepStale(runtimeKey, stepId)) {
      set.add(stepId);
    }
  }
  return set;
}

export function resolveFocusedGameStepId(params: {
  isCreatorRoute: boolean;
  isSequencePanelOpen: boolean;
  selectedSequenceStepId: string | null;
  scenarioSequence: { id: string }[];
  activeIndex: number;
}): string | null {
  const {
    isCreatorRoute,
    isSequencePanelOpen,
    selectedSequenceStepId,
    scenarioSequence,
    activeIndex,
  } = params;
  const effectiveSelectedStepId = resolveEffectiveSelectedSequenceStepId(
    isCreatorRoute,
    isSequencePanelOpen,
    selectedSequenceStepId,
  );
  return effectiveSelectedStepId ?? resolveGameActiveStepId(isCreatorRoute, scenarioSequence, activeIndex);
}

export function resolveCanonicalStepId(params: {
  selectedSequenceStepId: string | null | undefined;
  isCreatorRoute: boolean;
  scenarioSequence: { id: string }[];
  activeIndex: number;
}): string {
  const selectedStepId = params.selectedSequenceStepId?.trim() || null;
  return selectedStepId
    ?? resolveGameActiveStepId(params.isCreatorRoute, params.scenarioSequence, params.activeIndex)
    ?? params.scenarioSequence[0]?.id
    ?? "";
}

export function getMeasuredStepAccuracy(
  runtimeKey: string,
  stepId: string,
): number | null {
  return getStepAccuracyValue(runtimeKey, stepId);
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
