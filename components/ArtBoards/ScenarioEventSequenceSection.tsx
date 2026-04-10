"use client";

import { EventSequencePanel } from "./Drawboard/EventSequencePanel";
import { useEventsContext } from "./EventsContext";
import { useScenarioContext } from "./ScenarioContext";

export function ScenarioEventSequenceSection() {
  const { isCreatorContext, selectedScenarioId, selectedScenarioSequence } = useScenarioContext();
  const {
    creatorPreviewInteractive,
    effectiveSelectedSequenceStepId,
    gameActiveStepId,
    handleSelectStep,
    handleUpdateStep,
    isSequencePanelOpen,
    sequenceRuntime,
    staleStepIds,
  } = useEventsContext();

  if (!selectedScenarioId) {
    return null;
  }

  if (!(isSequencePanelOpen || sequenceRuntime.recordingMode !== "idle" || selectedScenarioSequence.length > 0)) {
    return null;
  }

  const normalizedActiveStepIndex = sequenceRuntime.activeIndex >= selectedScenarioSequence.length
    ? 0
    : sequenceRuntime.activeIndex;

  return (
    <div className="flex flex-none justify-center px-3">
      <EventSequencePanel
        creatorMode={isCreatorContext}
        interactivePreview={creatorPreviewInteractive}
        recordingMode={sequenceRuntime.recordingMode}
        steps={selectedScenarioSequence}
        activeStepIndex={normalizedActiveStepIndex}
        stepAccuracies={sequenceRuntime.stepAccuracies}
        staleStepIds={staleStepIds}
        autoReplay={sequenceRuntime.autoReplay}
        onUpdateStep={handleUpdateStep}
        selectedStepId={effectiveSelectedSequenceStepId ?? gameActiveStepId}
        onSelectStep={handleSelectStep}
      />
    </div>
  );
}
