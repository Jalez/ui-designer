"use client";

import { EventSequenceNavActions } from "@/components/Navbar/EventSequenceNavActions";
import { RecordingControls } from "@/components/Navbar/RecordingControls";
import type { NavbarRegistrySection } from "../../types";

type EventSectionControls = {
  isSequenceRecording: boolean;
  onClearSelectedSequence: () => void;
  onRemoveSelectedStep: () => void;
  onSetInteractive: (checked: boolean) => void;
  onStartContinuousRecording: () => void;
  onStartSingleStepRecording: () => void;
  onStopSequenceRecording: () => void;
  selectedSequenceScenarioId: string | null;
  showLive: boolean;
  selectedSequenceStepIsLast: boolean;
  selectedSequenceStepsLength: number;
};

export function registerEventsWorkbenchSection(controls: EventSectionControls, visible: boolean): NavbarRegistrySection {
  return {
    id: "events",
    order: 10,
    build: () => ({
      id: "events",
      visible,
      title: "Events",
      children: (
        <>
          <RecordingControls
            isSequenceRecording={controls.isSequenceRecording}
            selectedSequenceScenarioId={controls.selectedSequenceScenarioId}
            showLive={controls.showLive}
            selectedSequenceStepsLength={controls.selectedSequenceStepsLength}
            onSetInteractive={controls.onSetInteractive}
            onStartContinuousRecording={controls.onStartContinuousRecording}
            onStartSingleStepRecording={controls.onStartSingleStepRecording}
            onStopSequenceRecording={controls.onStopSequenceRecording}
          />
          <div className="mt-1 border-t border-border pt-1.5">
            <EventSequenceNavActions
              selectedSequenceStepIsLast={controls.selectedSequenceStepIsLast}
              selectedSequenceStepsLength={controls.selectedSequenceStepsLength}
              onClearSelectedSequence={controls.onClearSelectedSequence}
              onRemoveSelectedStep={controls.onRemoveSelectedStep}
            />
          </div>
        </>
      ),
    }),
  };
}
