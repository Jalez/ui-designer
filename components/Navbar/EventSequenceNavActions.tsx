"use client";

import { ListMinus, ListX } from "lucide-react";
import { WorkbenchSidebarToolRow } from "./WorkbenchSidebarToolRow";

type EventSequenceNavActionsProps = {
  selectedSequenceStepIsLast: boolean;
  selectedSequenceStepsLength: number;
  onClearSelectedSequence: () => void;
  onRemoveSelectedStep: () => void;
};

export function EventSequenceNavActions({
  selectedSequenceStepIsLast,
  selectedSequenceStepsLength,
  onClearSelectedSequence,
  onRemoveSelectedStep,
}: EventSequenceNavActionsProps) {
  return (
    <div className="flex w-full flex-col gap-0.5">
      {selectedSequenceStepsLength > 0 ? (
        <WorkbenchSidebarToolRow
          id="events-clear-events"
          label="Clear events"
          tooltip="Clear all recorded events for the selected scenario."
          icon={ListX}
          onClick={onClearSelectedSequence}
          variant="ghost"
        />
      ) : null}
      <WorkbenchSidebarToolRow
        id="events-remove-event"
        label="Remove event"
        tooltip="Only the last recorded event can be removed."
        icon={ListMinus}
        onClick={onRemoveSelectedStep}
        disabled={!selectedSequenceStepIsLast}
        variant="ghost"
      />
    </div>
  );
}
