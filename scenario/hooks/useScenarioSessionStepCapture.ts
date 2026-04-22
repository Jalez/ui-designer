"use client";

/**
 * useScenarioSessionStepCapture — resolves the currently focused drawing step,
 * subscribes to the session's per-step drawing captures, and keeps the
 * per-step interaction triggers and drawboard URL synced with the event
 * snapshot for that step.
 *
 * Extracted from EventsBoundScenarioDrawing so the orchestrator does not own
 * cache-key derivation and subscribe plumbing directly.
 */

import { useEffect, useMemo, useState } from "react";
import type { DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";
import {
  getSessionStepDrawingCapture,
  subscribeSessionStepDrawingCaptures,
  type SessionStepDrawingCapture,
} from "@/lib/drawboard/drawboardPixelsStore";
import type { InteractionTrigger, EventSequenceStep } from "@/types";

type UseScenarioSessionStepCaptureParams = {
  runtimeKey: string;
  drawboardCaptureMode: string;
  drawingArtifactDescriptor: DrawboardArtifactDescriptor;
  drawingVersion: number;
  scenarioSequence: EventSequenceStep[];
  selectedEventSequenceStepId?: string | null;
  gameplaySolutionStepId: string | null;
  isCreator: boolean;
  artifactDrawingUrl: string | undefined;
  frameEvents: InteractionTrigger[];
  setCurrentInteractionTriggers: (triggers: InteractionTrigger[], stepId?: string | null) => void;
  setCurrentEventDrawboardUrl: (url: string, stepId?: string | null) => void;
};

export type UseScenarioSessionStepCaptureResult = {
  currentDrawingStepId: string;
  sessionStepCaptureCacheKey: string;
  currentSessionStepCapture: SessionStepDrawingCapture | null;
  effectiveDrawingUrl: string | undefined;
};

export function useScenarioSessionStepCapture({
  runtimeKey,
  drawboardCaptureMode,
  drawingArtifactDescriptor,
  drawingVersion,
  scenarioSequence,
  selectedEventSequenceStepId,
  gameplaySolutionStepId,
  isCreator,
  artifactDrawingUrl,
  frameEvents,
  setCurrentInteractionTriggers,
  setCurrentEventDrawboardUrl,
}: UseScenarioSessionStepCaptureParams): UseScenarioSessionStepCaptureResult {
  const sessionStepCaptureCacheKey = useMemo(
    () => `${runtimeKey}:${drawboardCaptureMode}:${drawingArtifactDescriptor.fingerprint}:${drawingVersion}`,
    [drawingArtifactDescriptor.fingerprint, drawboardCaptureMode, runtimeKey, drawingVersion],
  );

  const currentDrawingStepId = useMemo(() => {
    const scrubbed = selectedEventSequenceStepId?.trim();
    const firstStepId = scenarioSequence[0]?.id ?? "";
    if (scenarioSequence.length > 0) {
      if (scrubbed) return scrubbed;
      if (!isCreator && gameplaySolutionStepId != null) return gameplaySolutionStepId;
      return firstStepId;
    }
    if (scrubbed) return scrubbed;
    return firstStepId;
  }, [gameplaySolutionStepId, isCreator, scenarioSequence, selectedEventSequenceStepId]);

  useEffect(() => {
    setCurrentInteractionTriggers(frameEvents, currentDrawingStepId);
  }, [currentDrawingStepId, frameEvents, setCurrentInteractionTriggers]);

  const [, setSessionStepCaptureSerial] = useState(0);
  useEffect(() => {
    // Refresh once when the cache key changes so the latest external capture is read immediately.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionStepCaptureSerial((v) => v + 1);
    return subscribeSessionStepDrawingCaptures(sessionStepCaptureCacheKey, () => {
      setSessionStepCaptureSerial((v) => v + 1);
    });
  }, [sessionStepCaptureCacheKey]);

  const currentSessionStepCapture = getSessionStepDrawingCapture(sessionStepCaptureCacheKey, currentDrawingStepId);
  const effectiveDrawingUrl = currentSessionStepCapture?.dataUrl ?? artifactDrawingUrl;

  useEffect(() => {
    if (!effectiveDrawingUrl) return;
    setCurrentEventDrawboardUrl(effectiveDrawingUrl, currentDrawingStepId);
  }, [currentDrawingStepId, effectiveDrawingUrl, setCurrentEventDrawboardUrl]);

  return {
    currentDrawingStepId,
    sessionStepCaptureCacheKey,
    currentSessionStepCapture,
    effectiveDrawingUrl,
  };
}
