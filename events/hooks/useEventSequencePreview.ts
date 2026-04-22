import { useMemo } from "react";
import { EventSequenceStep, InteractionTrigger } from "@/types";
import type { EventSequenceRecordingMode } from "@/events/core/eventSequenceReplayTypes";

const EMPTY_REPLAY_SEQUENCE: EventSequenceStep[] = [];
const EMPTY_TRIGGERS: InteractionTrigger[] = [];

type UseEventSequencePreviewParams = {
  isCreator: boolean;
  scenarioSequence: EventSequenceStep[];
  selectedEventSequenceStepId: string | null | undefined;
  recordingMode: EventSequenceRecordingMode;
  showLive: boolean | undefined;
  hasCapture: boolean;
};

type EventSequencePreviewResult = {
  selectedSequenceIndex: number;
  replaySequence: EventSequenceStep[];
  interactionTriggers: InteractionTrigger[];
  /** Whether the user should see the live iframe (user toggle / recording). */
  shouldShowInteractivePreview: boolean;
  isSequenceRecording: boolean;
};

export function useEventSequencePreview({
  isCreator,
  scenarioSequence,
  selectedEventSequenceStepId,
  recordingMode,
  showLive,
  hasCapture,
}: UseEventSequencePreviewParams): EventSequencePreviewResult {
  /**
   * Without a sequence: no capture → iframe; with capture → static bitmap (legacy UX).
   * With a sequence: a hydrated URL often exists while the per-step bitmap is wrong after refresh;
   * default to live iframe unless the user explicitly chose static (`creatorshowLive === false`).
   */
  const userPrefersInteractivePreview =
    isCreator
    && (showLive ?? (scenarioSequence.length > 0 ? true : !hasCapture));
  const isRecording = isCreator && recordingMode !== "idle";

  const selectedSequenceIndex =
    selectedEventSequenceStepId
      ? scenarioSequence.findIndex((step) => step.id === selectedEventSequenceStepId)
      : -1;

  /** User-visible interactive preview: user toggle or active recording. */
  const shouldShowInteractivePreview = userPrefersInteractivePreview || isRecording;
  /**
   * Even when the iframe isn't shown (initial step selected, static mode, no step selected),
   * keep it interactive so background replay can run for captures.
   * On the game route, also need a live frame when there are steps so the iframe can replay & capture per step.
   */
  const isSequenceRecording = recordingMode !== "idle"


  const replaySequence = useMemo(() => {
    if (!showLive) {
      return EMPTY_REPLAY_SEQUENCE;
    }
    if (scenarioSequence.length === 0) {
      return EMPTY_REPLAY_SEQUENCE;
    }
    // Creator + game: selected timeline step drives replay depth; the first stored step is capture-only.
    if (selectedSequenceIndex < 0) {
      return EMPTY_REPLAY_SEQUENCE;
    }
    return scenarioSequence.slice(0, selectedSequenceIndex+1);
  }, [scenarioSequence.length, selectedSequenceIndex, showLive]);

  const interactionTriggers = useMemo((): InteractionTrigger[] => {
    if (scenarioSequence.length === 0 || isSequenceRecording ) {
      return EMPTY_TRIGGERS;
    }

    let interactionTriggers = scenarioSequence.map((step) => stepToInteractionTrigger(step));

    if(selectedSequenceIndex >= 0) {
      interactionTriggers = interactionTriggers.slice(0, selectedSequenceIndex+1);
    }

    return interactionTriggers;
  }, [scenarioSequence.length, selectedSequenceIndex, isSequenceRecording]);


  return {
    selectedSequenceIndex,
    replaySequence,
    interactionTriggers,
    shouldShowInteractivePreview,
    isSequenceRecording,
  };
}

function stepToInteractionTrigger(step: Pick<EventSequenceStep, "id" | "eventType" | "selector" | "keyFilter" | "instruction">): InteractionTrigger {
  return {
    id: step.id,
    eventType: step.eventType,
    selector: step.selector,
    keyFilter: step.keyFilter,
    label: step.instruction,
  };
}
