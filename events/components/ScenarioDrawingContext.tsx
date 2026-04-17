'use client';

/**
 * ScenarioDrawingContext — scoped context provided by EventsBoundScenarioDrawing
 * for its subtree.
 *
 * Carries orchestrator-resolved values (artifact URLs, sequence presentation
 * state, callbacks) so ScenarioDrawing and its children don't need them
 * threaded as props. Plain Redux/Zustand state is still read directly in each
 * component — only values that require orchestrator-level computation live here.
 */

import { createContext, useContext } from "react";
import type { InteractionTrigger, EventSequenceStep, VerifiedInteraction } from "@/types";
import type { DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";
import type { FrameHandle, ReplayBatchCheckpoint, ReplayBatchStatusEvent } from "@/components/ArtBoards/Frame";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScenarioDrawingContextValue = {
  isCreator: boolean;
  // Resolved artifact URLs
  solutionUrl: string;
  effectiveDrawingUrl: string | undefined;
  drawingArtifactDescriptor: DrawboardArtifactDescriptor;
  sessionStepCaptureCacheKey: string;
  // Sequence presentation state
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

// ---------------------------------------------------------------------------
// Context + hook
// ---------------------------------------------------------------------------

export const ScenarioDrawingContext = createContext<ScenarioDrawingContextValue | null>(null);

export function useScenarioDrawingContext(): ScenarioDrawingContextValue {
  const ctx = useContext(ScenarioDrawingContext);
  if (!ctx) {
    throw new Error("useScenarioDrawingContext must be used within EventsBoundScenarioDrawing");
  }
  return ctx;
}
