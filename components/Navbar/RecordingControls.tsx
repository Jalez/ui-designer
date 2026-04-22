"use client";

import { Eye, ListOrdered, ListPlus, MousePointer, Square } from "lucide-react";
import { WorkbenchSidebarToolRow } from "./WorkbenchSidebarToolRow";

type RecordingControlsProps = {
  isSequenceRecording: boolean;
  selectedSequenceScenarioId: string | null;
  showLive: boolean;
  selectedSequenceStepsLength: number;
  onSetInteractive: (checked: boolean) => void;
  onStartContinuousRecording: () => void;
  onStartSingleStepRecording: () => void;
  onStopSequenceRecording: () => void;
};

export function RecordingControls({
  isSequenceRecording,
  selectedSequenceScenarioId,
  showLive,
  selectedSequenceStepsLength,
  onSetInteractive,
  onStartContinuousRecording,
  onStartSingleStepRecording,
  onStopSequenceRecording,
}: RecordingControlsProps) {
  if (!selectedSequenceScenarioId) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-0.5">
      <WorkbenchSidebarToolRow
        id="events-interaction-mode"
        label={showLive ? "Live" : "Static"}
        tooltip={showLive
          ? "Switch to static (read-only preview)."
          : "Switch to live mode to drive the scenario and record event sequences."}
        icon={showLive ? MousePointer : Eye}
        onClick={() => onSetInteractive(!showLive)}
        active={showLive}
        variant="secondary"
      />
      {!isSequenceRecording ? (
        <>
          <WorkbenchSidebarToolRow
            id="events-add-event"
            label="Add event"
            tooltip={!showLive
              ? "Turn on live mode to add an event."
              : "Record the next interaction as a single event."}
            icon={ListPlus}
            onClick={onStartSingleStepRecording}
            disabled={!showLive}
          />
          <WorkbenchSidebarToolRow
            id="events-record-sequence"
            label={selectedSequenceStepsLength > 0 ? "Set events" : "Create event sequence"}
            tooltip={!showLive
              ? "Turn on live mode to record an event sequence."
              : selectedSequenceStepsLength > 0
                ? "Record a new event sequence in one pass; saving replaces the current events."
                : "Record the full interaction sequence in one pass."}
            icon={ListOrdered}
            onClick={onStartContinuousRecording}
            disabled={!showLive}
          />
        </>
      ) : (
        <WorkbenchSidebarToolRow
          id="events-stop-recording"
          label="Stop & save"
          tooltip="Stop recording and save the event sequence."
          icon={Square}
          onClick={onStopSequenceRecording}
        />
      )}
    </div>
  );
}
