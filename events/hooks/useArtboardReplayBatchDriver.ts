"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { FrameHandle } from "@/components/ArtBoards/Frame";
import type { ReplayBatchSessionState } from "@/events/core/eventSequenceReplayTypes";
import type { EventSequenceStep } from "@/types";

type UseArtboardReplayBatchDriverParams = {
  batchVisibleStepIds: string[];
  enabled?: boolean;
  replayBatchSession: ReplayBatchSessionState | null;
  scenarioSequence: EventSequenceStep[];
};

type UseArtboardReplayBatchDriverResult = {
  frameRef: RefObject<FrameHandle | null>;
  frameReadyVersion: number;
  handleFrameReady: (instance: FrameHandle | null) => void;
};

export function useArtboardReplayBatchDriver({
  batchVisibleStepIds,
  enabled = true,
  replayBatchSession,
  scenarioSequence,
}: UseArtboardReplayBatchDriverParams): UseArtboardReplayBatchDriverResult {
  const frameRef = useRef<FrameHandle | null>(null);
  const requestedBatchRunIdRef = useRef<number | null>(null);
  const [frameReadyVersion, setFrameReadyVersion] = useState(0);

  const handleFrameReady = useCallback((instance: FrameHandle | null) => {
    frameRef.current = instance;
    setFrameReadyVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !scenarioSequence.length) {
      if (requestedBatchRunIdRef.current != null) {
        frameRef.current?.cancelReplayBatch(requestedBatchRunIdRef.current);
      }
      requestedBatchRunIdRef.current = null;
      return;
    }
    if (!replayBatchSession) {
      if (requestedBatchRunIdRef.current != null) {
        frameRef.current?.cancelReplayBatch(requestedBatchRunIdRef.current);
      }
      requestedBatchRunIdRef.current = null;
      return;
    }
    if (requestedBatchRunIdRef.current === replayBatchSession.runId) {
      return;
    }
    if (!frameRef.current) {
      return;
    }

    requestedBatchRunIdRef.current = replayBatchSession.runId;
    frameRef.current.requestReplayBatch({
      replaySequence: scenarioSequence,
      runId: replayBatchSession.runId,
      visibleStepIds: batchVisibleStepIds,
    });
  }, [batchVisibleStepIds, enabled, frameReadyVersion, replayBatchSession, scenarioSequence]);

  return {
    frameRef,
    frameReadyVersion,
    handleFrameReady,
  };
}
