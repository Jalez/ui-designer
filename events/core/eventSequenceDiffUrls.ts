import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "./eventSequenceState";

const STORAGE_KEY_SEP = "\uE001";

export function eventSequenceDiffStorageKey(scenarioId: string, stepId: string): string {
  return `${scenarioId}${STORAGE_KEY_SEP}${stepId}`;
}

export function resolveEventSequenceDiffUrl(
  differenceUrls: Record<string, string | undefined>,
  scenarioId: string,
  options: {
    usePerStepKeys: boolean;
    stepId: string | null | undefined;
  },
): string {
  const { usePerStepKeys, stepId } = options;
  if (usePerStepKeys) {
    const normalizedStepId = stepId?.trim() || INITIAL_EVENT_SEQUENCE_STEP_ID;
    return differenceUrls[eventSequenceDiffStorageKey(scenarioId, normalizedStepId)]?.trim() ?? "";
  }
  return differenceUrls[scenarioId]?.trim() ?? "";
}
