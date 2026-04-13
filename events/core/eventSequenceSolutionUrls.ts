import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "./eventSequenceState";

/** Private-use separator — scenarioId / stepId are UUID-like and won't contain it. */
const STORAGE_KEY_SEP = "\uE000";

export function eventSequenceSolutionStorageKey(scenarioId: string, stepId: string): string {
  return `${scenarioId}${STORAGE_KEY_SEP}${stepId}`;
}

export function resolveEventSequenceSolutionUrl(
  solutionUrls: Record<string, string | undefined>,
  scenarioId: string,
  options: {
    usePerStepKeys: boolean;
    /** Timeline step id (e.g. `__initial__` or a step id); ignored when not using per-step keys. */
    stepId: string | null | undefined;
    /**
     * When true (default), a missing per-step entry falls back to the legacy single `scenarioId` URL.
     * Set false for game + event sequence so each step must capture under its own key — otherwise the
     * legacy image blocks the transient solution iframe from mounting for uncaptured steps.
     */
    allowLegacyFallback?: boolean;
  },
): string {
  const { usePerStepKeys, stepId, allowLegacyFallback = true } = options;
  if (usePerStepKeys && stepId) {
    const keyed = solutionUrls[eventSequenceSolutionStorageKey(scenarioId, stepId)]?.trim();
    if (keyed) {
      return keyed;
    }
    if (allowLegacyFallback) {
      return solutionUrls[scenarioId]?.trim() ?? "";
    }
    return "";
  }
  return solutionUrls[scenarioId]?.trim() ?? "";
}

export function defaultTimelineStepIdForSolutionCapture(
  selectedEventSequenceStepId: string | null | undefined,
): string {
  const t = selectedEventSequenceStepId?.trim();
  if (t) {
    return t;
  }
  return INITIAL_EVENT_SEQUENCE_STEP_ID;
}
