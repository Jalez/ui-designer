import { useCallback, useSyncExternalStore } from "react";
import { getDrawboardPixelsSideSerials, subscribeDrawboardPixelsForScenario } from "@/lib/drawboard/drawboardPixelsStore";

function combinedSideActivitySerial(runtimeKey: string | null): number {
  if (!runtimeKey) return 0;
  const { drawing, solution } = getDrawboardPixelsSideSerials(runtimeKey);
  return drawing + solution;
}

/**
 * Subscribes to drawboard iframe pixel posts for a scenario. Snapshot is **drawing + solution**
 * serials so `useSyncExternalStore` re-renders when **either** side updates (solution-only posts
 * used to leave drawing serial at 0 and block browser-mode auto-replay mount readiness).
 */
export function useScenarioDrawingPixelsSerial(runtimeKey: string | null) {
  return useSyncExternalStore(
    useCallback(
      (listener) => (
        runtimeKey
          ? subscribeDrawboardPixelsForScenario(runtimeKey, listener)
          : () => { }
      ),
      [runtimeKey],
    ),
    useCallback(
      () => combinedSideActivitySerial(runtimeKey),
      [runtimeKey],
    ),
    useCallback(
      () => combinedSideActivitySerial(runtimeKey),
      [runtimeKey],
    ),
  );
}
