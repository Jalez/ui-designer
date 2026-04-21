"use client";

/**
 * ArtboardContext — board-facing view-model context.
 *
 * Phase 1 shell: this mirrors the existing drawing-board context shape so we
 * can migrate ownership boundaries without changing runtime behavior.
 */

import { createContext, useContext } from "react";
import type { InteractionTrigger, EventSequenceStep, VerifiedInteraction } from "@/types";
import type { DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";
import type { FrameHandle, ReplayBatchCheckpoint, ReplayBatchStatusEvent } from "@/components/ArtBoards/Frame";

export type ArtboardContextValue = {
  isCreator: boolean;
  // Resolved artifact URLs
  solutionUrl: string;
  effectiveDrawingUrl: string | undefined;
  drawingArtifactDescriptor: DrawboardArtifactDescriptor;
  sessionStepCaptureCacheKey: string;
  // Sequence presentation state
  currentDrawingStepId: string;
  frameEvents: InteractionTrigger[];
  replaySequence: EventSequenceStep[];
  shouldShowInteractivePreview: boolean;
  frameNeedsInteractive: boolean;
  isSequenceRecording: boolean;
  autoReplayRunning: boolean;
  shouldBypassSelectedStepReplay: boolean;
  // Callbacks
  onFrameReady: (instance: FrameHandle | null) => void;
  onVerifiedInteraction: (interaction: VerifiedInteraction) => void;
  onReplayBatchCheckpoint: (checkpoint: ReplayBatchCheckpoint) => void | Promise<void>;
  onReplayBatchStatus: (event: ReplayBatchStatusEvent) => void;
};

export const ArtboardContext = createContext<ArtboardContextValue | null>(null);

export function useArtboardContext(): ArtboardContextValue {
  const ctx = useContext(ArtboardContext);
  if (!ctx) {
    throw new Error("useArtboardContext must be used within EventsBoundScenarioDrawing");
  }
  return ctx;
}
