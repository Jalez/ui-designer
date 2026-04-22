"use client";

import { useEffect } from "react";
import { toast } from "sonner";

const REPLAY_DIAGNOSTIC_TOAST_ID = "events-replay-diagnostic";
const REPLAY_DIAGNOSTIC_TOAST_DELAY_MS = 1500;

type UseReplayDiagnosticToastParams = {
  activeSignature: string | null;
  startedAt: number | null;
  runningReplayDiagnosticSummary: string | null;
};

export function useReplayDiagnosticToast({
  activeSignature,
  startedAt,
  runningReplayDiagnosticSummary,
}: UseReplayDiagnosticToastParams) {
  useEffect(() => {
    if (!activeSignature || !runningReplayDiagnosticSummary) {
      toast.dismiss(REPLAY_DIAGNOSTIC_TOAST_ID);
      return;
    }

    const replayStart = startedAt ?? Date.now();
    const remainingDelay = Math.max(0, REPLAY_DIAGNOSTIC_TOAST_DELAY_MS - (Date.now() - replayStart));
    const timeoutId = window.setTimeout(() => {
      toast.loading(runningReplayDiagnosticSummary, {
        id: REPLAY_DIAGNOSTIC_TOAST_ID,
      });
    }, remainingDelay);

    return () => window.clearTimeout(timeoutId);
  }, [activeSignature, startedAt, runningReplayDiagnosticSummary]);

  useEffect(() => (
    () => {
      toast.dismiss(REPLAY_DIAGNOSTIC_TOAST_ID);
    }
  ), []);
}
