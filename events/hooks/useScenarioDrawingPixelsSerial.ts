import { useCallback, useSyncExternalStore } from "react";
import { getDrawboardPixelsSideSerials, subscribeDrawboardPixelsForScenario } from "@/lib/drawboard/drawboardPixelsStore";

function combinedSideActivitySerial(scenarioId: string | null): number {
  if (!scenarioId) return 0;
  const { drawing, solution } = getDrawboardPixelsSideSerials(scenarioId);
  return drawing + solution;
}

/**
 * Subscribes to drawboard iframe pixel posts for a scenario. Snapshot is **drawing + solution**
 * serials so `useSyncExternalStore` re-renders when **either** side updates (solution-only posts
 * used to leave drawing serial at 0 and block browser-mode auto-replay mount readiness).
 */
export function useScenarioDrawingPixelsSerial(selectedScenarioId: string | null) {
  return useSyncExternalStore(
    useCallback(
      (listener) => (
        selectedScenarioId
          ? subscribeDrawboardPixelsForScenario(selectedScenarioId, listener)
          : () => { }
      ),
      [selectedScenarioId],
    ),
    useCallback(
      () => combinedSideActivitySerial(selectedScenarioId),
      [selectedScenarioId],
    ),
    useCallback(
      () => combinedSideActivitySerial(selectedScenarioId),
      [selectedScenarioId],
    ),
  );
}
