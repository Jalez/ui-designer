"use client";

import type { ReactNode } from "react";
import { useScenarioContext } from "@/components/ArtBoards/ScenarioContext";
import { getEventSequenceRuntimeKey, selectRuntimeState, useEventSequenceStore } from "../core/eventSequenceState";
import { useScenarioDrawingPixelsSerial } from "../hooks/useScenarioDrawingPixelsSerial";
import { useEventsAutoReplayOrchestration } from "../hooks/useEventsAutoReplayOrchestration";

export function EventsProvider({ children }: { children: ReactNode }) {
  const {
    currentLevel,
    drawboardCaptureMode,
    isCreatorContext,
    selectedScenario,
    selectedScenarioSequence,
  } = useScenarioContext();

  const selectedScenarioId = selectedScenario?.scenarioId ?? null;
  const selectedRuntimeKey = selectedScenarioId
    ? getEventSequenceRuntimeKey(currentLevel, selectedScenarioId, isCreatorContext)
    : null;
  const sequenceRuntime = useEventSequenceStore((state) => (
    selectRuntimeState(state.runtimeByKey, selectedRuntimeKey)
  ));
  const selectedScenarioDrawingPixelsSerial = useScenarioDrawingPixelsSerial(selectedScenarioId);

  const autoReplayMountReady =
    drawboardCaptureMode !== "browser"
    || isCreatorContext
    || !selectedScenarioId
    || selectedScenarioDrawingPixelsSerial > 0;

  useEventsAutoReplayOrchestration({
    autoReplayMountReady,
    currentLevel,
    selectedRuntimeKey,
    selectedScenarioId,
    selectedScenarioSequence,
    sequenceRuntime,
  });

  return children;
}
