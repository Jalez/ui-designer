/** @format */
'use client';

import { useAppDispatch } from "@/store/hooks/hooks";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import ScenarioRemover from "./ScenarioRemover";
import SidebySideArt from "./SidebySideArt";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import type { ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AutoRunCircle } from "@/components/icons/AutoRunCircle";
import { cn } from "@/lib/utils/cn";
import { ChevronLeft, ChevronRight, ImageIcon, MousePointer, PanelsLeftRight, Play, Square } from "lucide-react";
import { toggleImageInteractivity } from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import PoppingTitle from "@/components/General/PoppingTitle";
import { setCreatorPreviewInteractiveForScenario } from "@/lib/drawboard/eventSequenceState";
import { ScenarioProvider, useScenarioContext } from "./ScenarioContext";
import { EventsProvider, useEventsContext } from "./EventsContext";
import { EventSequencePanel } from "./Drawboard/EventSequencePanel";

export const ArtBoards = (): ReactNode => {
  return (
    <ScenarioProvider>
      <EventsProvider>
        <ArtBoardsContent />
      </EventsProvider>
    </ScenarioProvider>
  );
};

function ArtBoardsContent() {
  const dispatch = useAppDispatch();
  const { syncLevelFields } = useLevelMetaSync();
  const {
    currentLevel,
    goToScenario,
    isCreatorContext,
    level,
    scenarios,
    selectedScenario,
    selectedScenarioIndex,
    selectedScenarioSequence,
    setSelectedScenarioId,
    setSingleLayoutControl,
    showHotkeys,
    singleLayoutControl,
  } = useScenarioContext();
  const {
    autoReplayOnMount,
    creatorPreviewInteractive,
    effectiveSelectedSequenceStepId,
    forceInitialStepForAutoReplayStart,
    gameActiveStepId,
    handleRunEventsClick,
    handleSelectStep,
    handleToggleAutoRunOnMount,
    handleUpdateStep,
    isSequencePanelOpen,
    pendingManualAutoReplay,
    sequenceRuntime,
    showEventRunControls,
    staleStepIds,
  } = useEventsContext();

  if (!level) {
    return null;
  }

  const handleSwitchInteractiveStatic = () => {
    if (isCreatorContext) {
      if (!selectedScenario) return;
      setCreatorPreviewInteractiveForScenario(currentLevel, selectedScenario.scenarioId, !creatorPreviewInteractive);
      return;
    }
    dispatch(toggleImageInteractivity(currentLevel));
    syncLevelFields(currentLevel - 1, ["interactive"]);
  };

  const interactive = level?.interactive ?? false;
  const showSwitch = Boolean(selectedScenario);
  const switchIsInteractive = isCreatorContext ? creatorPreviewInteractive : interactive;
  const normalizedActiveStepIndex = sequenceRuntime.activeIndex >= selectedScenarioSequence.length
    ? 0
    : sequenceRuntime.activeIndex;
  const eventRunButtons = showEventRunControls ? (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 shrink-0 border-0 shadow-none",
              (sequenceRuntime.autoReplay?.running || pendingManualAutoReplay) && "bg-muted hover:bg-muted/90",
            )}
            onClick={handleRunEventsClick}
            aria-label={
              sequenceRuntime.autoReplay?.running
                ? "Stop scenario run"
                : pendingManualAutoReplay
                  ? "Preparing scenario run"
                  : "Run Scenario events"
            }
          >
            {sequenceRuntime.autoReplay?.running ? (
              <Square className="h-4 w-4 shrink-0" />
            ) : pendingManualAutoReplay ? (
              <Play className="h-4 w-4 shrink-0 opacity-60" />
            ) : (
              <Play className="h-4 w-4 shrink-0" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-snug">
          {sequenceRuntime.autoReplay?.running
            ? "Stop scenario run"
            : pendingManualAutoReplay
              ? "Preparing the drawboard after refresh, then running scenario events automatically."
              : "Run Scenario events"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 shrink-0 border-0 shadow-none",
              autoReplayOnMount && "bg-muted hover:bg-muted/90",
            )}
            onClick={handleToggleAutoRunOnMount}
            aria-label="Auto Run scenario-events upon page refresh"
          >
            <AutoRunCircle className="h-4 w-4 shrink-0" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-snug">
          Auto Run scenario-events upon page refresh
        </TooltipContent>
      </Tooltip>
    </>
  ) : null;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {scenarios.length > 1 || eventRunButtons ? (
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 px-3 pb-3 pt-1"
          data-tour-spot="gameboard.scenario_run_controls"
        >
          {scenarios.length > 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={selectedScenarioIndex <= 0}
                onClick={() => goToScenario(selectedScenarioIndex - 1)}
                aria-label="Show previous scenario"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Select
                value={selectedScenario?.scenarioId ?? ""}
                onValueChange={setSelectedScenarioId}
              >
                <SelectTrigger
                  className={cn(
                    "h-9 w-auto min-w-0 max-w-[min(100%,12rem)] shrink gap-1 px-2",
                    "border-0 bg-transparent shadow-none",
                    "ring-0 ring-offset-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                    "data-[state=open]:ring-0 [&>span]:flex-none [&>span]:truncate",
                  )}
                >
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario, index) => (
                    <SelectItem key={scenario.scenarioId} value={scenario.scenarioId}>
                      Scenario {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {eventRunButtons}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={selectedScenarioIndex < 0 || selectedScenarioIndex >= scenarios.length - 1}
                onClick={() => goToScenario(selectedScenarioIndex + 1)}
                aria-label="Show next scenario"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          ) : (
            eventRunButtons
          )}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 w-full flex-col">
        {selectedScenario && (isSequencePanelOpen || sequenceRuntime.recordingMode !== "idle" || selectedScenarioSequence.length > 0) ? (
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
        ) : null}
        {selectedScenario ? (
          <section className="relative flex min-h-0 flex-1 w-full items-center justify-center">
            {sequenceRuntime.recordingMode !== "idle" ? (
              <div className="pointer-events-none absolute left-1/2 top-3 z-[90] -translate-x-1/2 rounded-full bg-red-500/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm">
                Recording
              </div>
            ) : null}
            <SidebySideArt
              key={selectedScenario.scenarioId}
              onSingleLayoutControlChange={setSingleLayoutControl}
              contents={[
                <ScenarioModel
                  key={`${selectedScenario.scenarioId}-model`}
                  scenario={selectedScenario}
                  creatorMode={isCreatorContext}
                  creatorPreviewInteractive={creatorPreviewInteractive}
                  selectedEventSequenceStepId={effectiveSelectedSequenceStepId}
                  gameplaySolutionStepId={gameActiveStepId}
                  eventSequenceScopedTriggers={selectedScenarioSequence.length > 0}
                  forceEmptyReplaySequence={forceInitialStepForAutoReplayStart}
                  registerForNavbarCapture
                />,
                <ScenarioDrawing
                  key={`${selectedScenario.scenarioId}-draw`}
                  scenario={selectedScenario}
                  creatorMode={isCreatorContext}
                  creatorPreviewInteractive={creatorPreviewInteractive}
                  selectedEventSequenceStepId={effectiveSelectedSequenceStepId}
                  gameplaySolutionStepId={gameActiveStepId}
                  eventSequenceScopedTriggers={selectedScenarioSequence.length > 0}
                  forceEmptyReplaySequence={forceInitialStepForAutoReplayStart}
                  registerForNavbarCapture
                />,
              ]}
            />
          </section>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
            No scenarios found
          </div>
        )}

        {showHotkeys ? (
          <div className="mt-3 flex justify-center">
            <KeyBindings />
          </div>
        ) : null}
      </div>

      <div
        className="absolute bottom-0 right-0 z-[100] flex flex-row items-center gap-1 p-2"
        data-tour-spot="gameboard.artboard_actions"
      >
        {singleLayoutControl ? (
          <PoppingTitle topTitle={`Show ${singleLayoutControl.label}`}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/85"
              onClick={singleLayoutControl.onClick}
              aria-label={`Show ${singleLayoutControl.label}`}
            >
              <PanelsLeftRight className="h-5 w-5" />
            </Button>
          </PoppingTitle>
        ) : null}
        {showSwitch ? (
          <PoppingTitle topTitle={switchIsInteractive ? "Switch to Static" : "Switch to Live"}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/85"
              onClick={handleSwitchInteractiveStatic}
              aria-label={switchIsInteractive ? "Switch to static" : "Switch to live"}
            >
              {switchIsInteractive ? <ImageIcon className="h-5 w-5" /> : <MousePointer className="h-5 w-5" />}
            </Button>
          </PoppingTitle>
        ) : null}
        <ScenarioRemover
          scenarioId={selectedScenario?.scenarioId ?? null}
          canRemove={scenarios.length > 1}
          className="h-9 w-9 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/85"
        />
        <ScenarioAdder className="h-9 w-9 rounded-full bg-muted text-foreground shadow-sm hover:bg-muted/85" />
      </div>
    </div>
  );
}
