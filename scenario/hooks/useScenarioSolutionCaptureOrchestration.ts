"use client";

/**
 * useScenarioSolutionCaptureOrchestration — scenario-level solution frame
 * lifecycle. Owns the solution FrameHandle and batch replay request wiring.
 *
 * The solution board no longer registers a separate browser preflight runner.
 * Shared artboard runtime now waits for solution checkpoints directly.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { type ReplayBatchSessionState } from "@/events/core/eventSequenceReplayTypes";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import type { EventSequenceStep } from "@/types";

type UseScenarioSolutionCaptureOrchestrationParams = {
  scenarioSequence: EventSequenceStep[];
  batchVisibleStepIds: string[];
  eventSequenceRunActive: boolean;
  replayBatchSession: ReplayBatchSessionState | null;
};

export function useScenarioSolutionCaptureOrchestration({
  scenarioSequence,
  batchVisibleStepIds,
  eventSequenceRunActive,
  replayBatchSession,
}: UseScenarioSolutionCaptureOrchestrationParams) {
  const solutionFrameRef = useRef<FrameHandle | null>(null);
  const [solutionFrameReadyVersion, setSolutionFrameReadyVersion] = useState(0);

  // Paired with `forceEmptyReplaySequence={autoReplayRunning}` in the consumer so options-patch
  // baseline resets do not race with the batch animation.
  const requestedSolutionBatchRunIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!scenarioSequence.length) return;
    if (!eventSequenceRunActive || !replayBatchSession) {
      if (requestedSolutionBatchRunIdRef.current != null) {
        solutionFrameRef.current?.cancelReplayBatch(requestedSolutionBatchRunIdRef.current);
      }
      requestedSolutionBatchRunIdRef.current = null;
      return;
    }
    if (requestedSolutionBatchRunIdRef.current === replayBatchSession.runId) return;
    if (!solutionFrameRef.current) return;

    requestedSolutionBatchRunIdRef.current = replayBatchSession.runId;
    solutionFrameRef.current.requestReplayBatch({
      replaySequence: scenarioSequence,
      runId: replayBatchSession.runId,
      visibleStepIds: batchVisibleStepIds,
    });
  }, [batchVisibleStepIds, eventSequenceRunActive, replayBatchSession, scenarioSequence, solutionFrameReadyVersion]);

  const handleSolutionFrameReady = useCallback((handle: FrameHandle | null) => {
    solutionFrameRef.current = handle;
    setSolutionFrameReadyVersion((v) => v + 1);
  }, []);

  return {
    handleSolutionFrameReady,
  };
}
