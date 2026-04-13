import { useEffect, useMemo } from "react";
import { EventSequenceStep, InteractionTrigger } from "@/types";
import { INITIAL_EVENT_SEQUENCE_STEP_ID, type EventSequenceRecordingMode } from "@/events/core/eventSequenceState";
import { stepToInteractionTrigger } from "@/events/core/interactionEvents";

const EMPTY_REPLAY_SEQUENCE: EventSequenceStep[] = [];
const EMPTY_TRIGGERS: InteractionTrigger[] = [];

type UseEventSequencePreviewParams = {
  isCreator: boolean;
  scenarioSequence: EventSequenceStep[];
  selectedEventSequenceStepId: string | null | undefined;
  eventSequenceScopedTriggers: boolean;
  recordingMode: EventSequenceRecordingMode;
  creatorPreviewInteractive: boolean | undefined;
  hasCapture: boolean;
  fallbackEvents: InteractionTrigger[];
};

type EventSequencePreviewResult = {
  selectedSequenceIndex: number;
  replaySequence: EventSequenceStep[];
  interactionTriggers: InteractionTrigger[];
  /** Whether the user should see the live iframe (user toggle / recording). */
  shouldShowInteractivePreview: boolean;
  /** Whether the Frame needs interactiveOverride=true (includes background replay for step scrub in static mode). */
  frameNeedsInteractive: boolean;
  isSequenceRecording: boolean;
};

export function useEventSequencePreview({
  isCreator,
  scenarioSequence,
  selectedEventSequenceStepId,
  eventSequenceScopedTriggers,
  recordingMode,
  creatorPreviewInteractive,
  hasCapture,
  fallbackEvents,
}: UseEventSequencePreviewParams): EventSequencePreviewResult {
  /**
   * Without a sequence: no capture → iframe; with capture → static bitmap (legacy UX).
   * With a sequence: a hydrated URL often exists while the per-step bitmap is wrong after refresh;
   * default to live iframe unless the user explicitly chose static (`creatorPreviewInteractive === false`).
   */
  const userPrefersInteractivePreview =
    isCreator
    && (creatorPreviewInteractive ?? (scenarioSequence.length > 0 ? true : !hasCapture));
  const isRecording = isCreator && recordingMode !== "idle";

  const selectedSequenceIndex =
    selectedEventSequenceStepId && selectedEventSequenceStepId !== INITIAL_EVENT_SEQUENCE_STEP_ID
      ? scenarioSequence.findIndex((step) => step.id === selectedEventSequenceStepId)
      : -1;

  /** User-visible interactive preview: user toggle or active recording. */
  const shouldShowInteractivePreview = userPrefersInteractivePreview || isRecording;
  /**
   * Even when the iframe isn't shown (initial step selected, static mode, no step selected),
   * keep it interactive so background replay can run for captures.
   * In game mode, also need a live frame when there are steps so the iframe can replay & capture per step.
   */
  const stepScrubNeedsLiveFrame =
    isCreator && eventSequenceScopedTriggers && scenarioSequence.length > 0;
  /** Any game level with a sequence needs a live iframe for per-step capture + scrub (incl. initial = empty replay). */
  const gameNeedsLiveFrame = !isCreator && scenarioSequence.length > 0;
  const frameNeedsInteractive = shouldShowInteractivePreview || stepScrubNeedsLiveFrame || gameNeedsLiveFrame;
  const isSequenceRecording = recordingMode !== "idle" && frameNeedsInteractive;

  const replaySequence = useMemo(() => {
    if (!frameNeedsInteractive) {
      return EMPTY_REPLAY_SEQUENCE;
    }
    if (scenarioSequence.length === 0) {
      return EMPTY_REPLAY_SEQUENCE;
    }
    // Creator + game: selected timeline step drives replay depth (__initial__ => no steps replayed).
    if (selectedSequenceIndex < 0) {
      return EMPTY_REPLAY_SEQUENCE;
    }
    return scenarioSequence.slice(0, selectedSequenceIndex + 1);
  }, [frameNeedsInteractive, selectedSequenceIndex, scenarioSequence]);

  const interactionTriggers = useMemo((): InteractionTrigger[] => {
    if (scenarioSequence.length > 0) {
      if (isCreator) {
        if (isSequenceRecording) {
          return EMPTY_TRIGGERS;
        }
        if (eventSequenceScopedTriggers) {
          if (selectedSequenceIndex >= 0) {
            return scenarioSequence
              .slice(0, selectedSequenceIndex + 1)
              .map((step) => stepToInteractionTrigger(step));
          }
          return EMPTY_TRIGGERS;
        }
        return scenarioSequence.map((step) => stepToInteractionTrigger(step));
      }
      // Game (e.g. ArtBoards): same prefix as creator scoped mode so scrub + template stay in sync.
      if (eventSequenceScopedTriggers) {
        if (selectedSequenceIndex >= 0) {
          return scenarioSequence
            .slice(0, selectedSequenceIndex + 1)
            .map((step) => stepToInteractionTrigger(step));
        }
        return EMPTY_TRIGGERS;
      }
      return scenarioSequence.map((step) => stepToInteractionTrigger(step));
    }

    return fallbackEvents;
  }, [
    eventSequenceScopedTriggers,
    fallbackEvents,
    isCreator,
    isSequenceRecording,
    scenarioSequence,
    selectedSequenceIndex,
  ]);

  // #region agent log
  useEffect(() => {
    fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", { method: "POST", headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a735ed" }, body: JSON.stringify({ sessionId: "a735ed", runId: "verify-static", hypothesisId: "H-STATIC", location: "useEventSequencePreview.ts", message: "preview_mode", data: { seqLen: scenarioSequence.length, hasCapture, creatorPreviewInteractive: creatorPreviewInteractive ?? null, userPrefersInteractivePreview, shouldShowInteractivePreview }, timestamp: Date.now() }) }).catch(() => {});
  }, [creatorPreviewInteractive, hasCapture, scenarioSequence.length, shouldShowInteractivePreview, userPrefersInteractivePreview]);
  // #endregion

  return {
    selectedSequenceIndex,
    replaySequence,
    interactionTriggers,
    shouldShowInteractivePreview,
    frameNeedsInteractive,
    isSequenceRecording,
  };
}
