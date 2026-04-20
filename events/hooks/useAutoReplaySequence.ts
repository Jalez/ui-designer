import { useEffect, useRef } from "react";
import {
  getStepAccuracyValue,
  isStepStale,
  useEventSequenceCaptureStore,
  waitForStepAccuracy,
} from "@/events/core/eventSequenceCaptureStore";
import { endReplayBatch } from "@/events/core/eventSequenceFacades";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "@/events/core/eventSequenceReplayTypes";
import { useSequenceReplayStore } from "@/events/core/sequenceReplayStore";
import { useEventSequenceTimelineUiStore } from "@/events/core/eventSequenceTimelineUiStore";
import type { ReplayBatchSessionState } from "@/events/core/eventSequenceReplayTypes";
import type { EventSequenceStep } from "@/types";

/** Lets React paint each selected step when scores are reused; otherwise the loop jumps to the last step in one frame. */
const STEP_DWELL_WHEN_REUSING_MS = 140;

type UseAutoReplaySequenceParams = {
  runtimeKey: string | null;
  levelId: number;
  scenarioId: string | null;
  steps: EventSequenceStep[];
  replayBatchSession: ReplayBatchSessionState | null;
};

/**
 * Watches for `useEventSequenceRunStore` `isRunning` plus `replayBatchSession` and, when
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
  replayBatchSession,
}: UseAutoReplaySequenceParams) {
  const eventSequenceRunIsActive = useSequenceReplayStore((state) => state.isRunning);
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

    if (!useSequenceReplayStore.getState().isRunning || !replayBatchSession) {
      return;
    }

    cancelledRef.current = false;

    const stepsSnapshot = stepsRef.current;
    const timelineSteps = stepsSnapshot.filter((step) => step.showInTimeline !== false);
    const displayStepIds = [INITIAL_EVENT_SEQUENCE_STEP_ID, ...timelineSteps.map((s) => s.id)];
    const totalSteps = displayStepIds.length;

    const run = async () => {
      // Save the step that was selected before auto-replay started so we can
      // restore it afterward (if the user hasn't clicked away).
      const originalStepId = displayStepIds[0];

      for (let i = 0; i < displayStepIds.length; i++) {
        if (cancelledRef.current) {
          break;
        }

        const stepId = displayStepIds[i]!;
        const cachedAccuracy = getStepAccuracyValue(runtimeKey, stepId);
        const canReuseCachedAccuracy =
          typeof cachedAccuracy === "number"
          && Number.isFinite(cachedAccuracy)
          && cachedAccuracy >= 0
          && !isStepStale(runtimeKey, stepId);

        useSequenceReplayStore.getState().setBatchProgress(runtimeKey, i, totalSteps);

        // Select this step — triggers replay + comparison in ScenarioDrawing.
        useEventSequenceTimelineUiStore.getState().setSelectedStep(levelId, scenarioId, stepId);

        if (canReuseCachedAccuracy) {
          await new Promise<void>((resolve) => setTimeout(resolve, STEP_DWELL_WHEN_REUSING_MS));
          if (cancelledRef.current) {
            break;
          }
          continue;
        }

        // No fresh cached score exists for this step, so wait for a new compare result.
        useEventSequenceCaptureStore.getState().markStepAccuracyPending(runtimeKey, stepId);

        // Give the iframe a moment to start the replay before we wait for accuracy.
        await new Promise((resolve) => setTimeout(resolve, 200));

        if (cancelledRef.current) {
          break;
        }

        try {
          await waitForStepAccuracy(runtimeKey, stepId, 15_000);
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
        endReplayBatch(runtimeKey);
        // Stay on the last event so the user sees final results.
        useEventSequenceTimelineUiStore.getState().setSelectedStep(
          levelId,
          scenarioId,
          displayStepIds[displayStepIds.length - 1] ?? originalStepId,
        );
      }
    };

    void run().catch((error) => {
      console.error("Auto-replay failed:", error);
      endReplayBatch(runtimeKey);
    });

    return () => {
      cancelledRef.current = true;
    };
  }, [runtimeKey, levelId, scenarioId, eventSequenceRunIsActive, replayBatchSession]);
}
