import { useEffect, useRef } from "react";
import {
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  isStepStale,
  useEventSequenceStore,
} from "@/events/core/eventSequenceState";
import type { EventSequenceStep } from "@/types";
import type { AutoReplayState } from "@/events/core/eventSequenceState";

type UseAutoReplaySequenceParams = {
  runtimeKey: string | null;
  levelId: number;
  scenarioId: string | null;
  steps: EventSequenceStep[];
  autoReplay: AutoReplayState | null;
};

/**
 * Watches for `autoReplay.running` in the sequence runtime state and, when
 * active, cycles through every display step (initial + recorded steps),
 * selecting each one and waiting for its accuracy comparison to complete.
 *
 * The comparison itself is handled by ScenarioDrawing's existing effect —
 * this hook just automates step selection.
 */
export function useAutoReplaySequence({
  runtimeKey,
  levelId,
  scenarioId,
  steps,
  autoReplay,
}: UseAutoReplaySequenceParams) {
  const cancelledRef = useRef(false);
  /** Avoid effect teardown when `steps` gets a new array identity from Redux while replay is running. */
  const stepsRef = useRef(steps);
  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);

  useEffect(() => {
    if (!runtimeKey || !scenarioId) {
      return;
    }

    if (!autoReplay?.running) {
      return;
    }

    cancelledRef.current = false;

    const stepsSnapshot = stepsRef.current;
    const timelineSteps = stepsSnapshot.filter((step) => step.showInTimeline !== false);
    const displayStepIds = [INITIAL_EVENT_SEQUENCE_STEP_ID, ...timelineSteps.map((s) => s.id)];
    const totalSteps = displayStepIds.length;

    // #region agent log
    fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a735ed" }, body: JSON.stringify({ sessionId: "a735ed", runId: "verify-ar", hypothesisId: "H-AR", location: "useAutoReplaySequence.ts:effect-start", message: "auto_replay_effect_start", data: { scenarioId, totalSteps, stepCount: stepsSnapshot.length }, timestamp: Date.now() }) }).catch(() => {});
    // #endregion

    const run = async () => {
      // Save the step that was selected before auto-replay started so we can
      // restore it afterward (if the user hasn't clicked away).
      const originalStepId = displayStepIds[0];

      for (let i = 0; i < displayStepIds.length; i++) {
        if (cancelledRef.current) {
          break;
        }

        const stepId = displayStepIds[i]!;
        const runtimeState = useEventSequenceStore.getState().getRuntimeState(runtimeKey);
        const cachedAccuracy = runtimeState.stepAccuracies[stepId];
        const canReuseCachedAccuracy =
          typeof cachedAccuracy === "number"
          && Number.isFinite(cachedAccuracy)
          && cachedAccuracy >= 0
          && !isStepStale(runtimeState, stepId);

        useEventSequenceStore.getState().setAutoReplayProgress(runtimeKey, i, totalSteps);

        // Select this step — triggers replay + comparison in ScenarioDrawing.
        useEventSequenceStore.getState().setSelectedStep(levelId, scenarioId, stepId);

        if (canReuseCachedAccuracy) {
          continue;
        }

        // No fresh cached score exists for this step, so wait for a new compare result.
        useEventSequenceStore.getState().markStepAccuracyPending(runtimeKey, stepId);

        // Give the iframe a moment to start the replay before we wait for accuracy.
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (cancelledRef.current) {
          break;
        }

        try {
          await useEventSequenceStore.getState().waitForStepAccuracy(runtimeKey, stepId, 15_000);
        } catch {
          // Timeout — move on to the next event.
          console.warn(`Auto-replay: timed out waiting for event ${stepId}`);
        }

        if (cancelledRef.current) {
          break;
        }
      }

      // Finished — clear auto-replay state.
      if (!cancelledRef.current) {
        // #region agent log
        fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a735ed" }, body: JSON.stringify({ sessionId: "a735ed", runId: "verify-ar", hypothesisId: "H-AR", location: "useAutoReplaySequence.ts:run-done", message: "auto_replay_run_finished", data: { scenarioId, totalSteps }, timestamp: Date.now() }) }).catch(() => {});
        // #endregion
        useEventSequenceStore.getState().stopAutoReplay(runtimeKey);
        // Stay on the last event so the user sees final results.
        useEventSequenceStore.getState().setSelectedStep(levelId, scenarioId, displayStepIds[displayStepIds.length - 1] ?? originalStepId);
      }
    };

    void run().catch((error) => {
      console.error("Auto-replay failed:", error);
      useEventSequenceStore.getState().stopAutoReplay(runtimeKey);
    });

    return () => {
      // #region agent log
      fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a735ed" }, body: JSON.stringify({ sessionId: "a735ed", runId: "verify-ar", hypothesisId: "H-AR", location: "useAutoReplaySequence.ts:effect-cleanup", message: "auto_replay_effect_cleanup_cancel", data: { scenarioId, hadRunning: Boolean(autoReplay?.running) }, timestamp: Date.now() }) }).catch(() => {});
      // #endregion
      cancelledRef.current = true;
    };
  }, [runtimeKey, levelId, scenarioId, autoReplay?.running]);
}
