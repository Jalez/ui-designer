/** @format */
'use client';

import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { KeyBindings } from "@/components/Editors/KeyBindings";
import ScenarioAdder from "./ScenarioAdder";
import ScenarioRemover from "./ScenarioRemover";
import SidebySideArt, { type SingleLayoutControl } from "./SidebySideArt";
import { ScenarioDrawing } from "./Drawboard/ScenarioDrawing";
import { ScenarioModel } from "./ModelBoard/ScenarioModel";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { scenario } from "@/types";
import {
  toggleImageInteractivity,
  updateEventSequenceStep,
} from "@/store/slices/levels.slice";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";
import PoppingTitle from "@/components/General/PoppingTitle";
import {
  EMPTY_SEQUENCE_RUNTIME_STATE,
  INITIAL_EVENT_SEQUENCE_STEP_ID,
  hasAutoReplayMountedRun,
  getEventSequenceScenarioUiKey,
  getEventSequenceRuntimeKey,
  getSequenceRuntimeState,
  isStepStale,
  markAutoReplayMountedRun,
  cancelAutoReplay,
  requestAutoReplay,
  setAutoReplayOnMount,
  setCreatorPreviewInteractiveForScenario,
  setSelectedEventSequenceStepId,
  setSelectedScenarioIdForLevel,
  subscribeSequenceRuntime,
  useEventSequenceUiState,
} from "@/lib/drawboard/eventSequenceState";
import {
  getDrawboardPixelsSideSerials,
  subscribeDrawboardPixelsForScenario,
} from "@/lib/drawboard/drawboardPixelsStore";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { EventSequencePanel } from "./Drawboard/EventSequencePanel";
import { useAutoReplaySequence } from "@/lib/drawboard/useAutoReplaySequence";
import { apiUrl, stripBasePath } from "@/lib/apiUrl";
import { buildArtifactKey, type DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";
import { drawingArtifactFingerprint } from "@/lib/drawboard/artifactFingerprint";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";

const EMPTY_SCENARIOS: scenario[] = [];

export const ArtBoards = (): React.ReactNode => {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ gameId?: string }>();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string | undefined>);
  const currentGameId = useGameStore((state) => state.currentGameId);
  const isCreatorRoute = pathname?.startsWith("/creator/") ?? false;
  const isCreatorContext = isCreatorRoute;
  const routeGameIdParam = params?.gameId;
  const routeGameId = Array.isArray(routeGameIdParam) ? routeGameIdParam[0] : routeGameIdParam;
  const { syncLevelFields } = useLevelMetaSync();
  const { drawboardCaptureMode } = useGameRuntimeConfig();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [restoredScenarioKey, setRestoredScenarioKey] = useState<string | null>(null);
  const showHotkeys = level?.showHotkeys ?? false;
  const scenarios = level?.scenarios ?? EMPTY_SCENARIOS;
  const [singleLayoutControl, setSingleLayoutControl] = useState<SingleLayoutControl | null>(null);

  const selectedScenario = useMemo(() => {
    if (scenarios.length === 0) {
      return null;
    }

    return scenarios.find((scenario) => scenario.scenarioId === selectedScenarioId)
      ?? scenarios[0];
  }, [scenarios, selectedScenarioId]);

  const selectedScenarioIndex = selectedScenario
    ? scenarios.findIndex((scenario) => scenario.scenarioId === selectedScenario.scenarioId)
    : -1;

  const platformBucket = useMemo(
    () => (drawboardCaptureMode === "browser" ? getBrowserPlatformBucket() : null),
    [drawboardCaptureMode],
  );
  const selectedScenarioDrawingArtifactDescriptor = useMemo<DrawboardArtifactDescriptor | null>(() => {
    if (!level || !selectedScenario) {
      return null;
    }
    return {
      version: "v1",
      captureMode: drawboardCaptureMode,
      artifactType: "drawing",
      fingerprint: drawingArtifactFingerprint({
        html: level.code.html ?? "",
        css: level.code.css ?? "",
        js: level.code.js ?? "",
        scenario: selectedScenario,
      }),
      gameId: currentGameId,
      levelIdentifier: level.identifier ?? null,
      levelName: level.name ?? null,
      scenarioId: selectedScenario.scenarioId,
      stepId: null,
      platformBucket,
      width: selectedScenario.dimensions.width,
      height: selectedScenario.dimensions.height,
    };
  }, [currentGameId, drawboardCaptureMode, level, platformBucket, selectedScenario]);
  const selectedScenarioDrawingUrl = useMemo(() => {
    if (!selectedScenarioDrawingArtifactDescriptor) {
      return undefined;
    }
    return drawingUrls[buildArtifactKey(selectedScenarioDrawingArtifactDescriptor)];
  }, [drawingUrls, selectedScenarioDrawingArtifactDescriptor]);
  const scenarioRestoreKey = routeGameId ? `${routeGameId}:${currentLevel}` : null;
  const selectedScenarioPreviewChoice = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return undefined;
      }
      return state.creatorPreviewInteractiveByScenario[
        getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)
      ];
    }, [currentLevel, selectedScenario]),
  );
  const isSequencePanelOpen = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return false;
      }
      return state.panelOpenByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)] ?? false;
    }, [currentLevel, selectedScenario]),
  );
  const selectedSequenceStepId = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return null;
      }
      return state.selectedStepIdByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)] ?? null;
    }, [currentLevel, selectedScenario]),
  );
  const autoReplayOnMount = useEventSequenceUiState(
    useCallback((state) => {
      if (!selectedScenario) {
        return false;
      }
      return state.autoReplayOnMountByScenario[getEventSequenceScenarioUiKey(currentLevel, selectedScenario.scenarioId)] ?? false;
    }, [currentLevel, selectedScenario]),
  );
  const creatorPreviewInteractive = selectedScenario
    ? (selectedScenarioPreviewChoice ?? !selectedScenarioDrawingUrl)
    : false;

  const goToScenario = (nextIndex: number) => {
    const nextScenario = scenarios[nextIndex];
    if (!nextScenario) {
      return;
    }

    setSelectedScenarioId(nextScenario.scenarioId);
  };

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
  const selectedRuntimeKey = selectedScenario
    ? getEventSequenceRuntimeKey(currentLevel, selectedScenario.scenarioId, isCreatorContext)
    : null;
  const sequenceRuntime = useSyncExternalStore(
    useCallback(
      (listener) => (selectedRuntimeKey ? subscribeSequenceRuntime(selectedRuntimeKey, listener) : () => {}),
      [selectedRuntimeKey],
    ),
    useCallback(
      () => (selectedRuntimeKey ? getSequenceRuntimeState(selectedRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedRuntimeKey],
    ),
    useCallback(
      () => (selectedRuntimeKey ? getSequenceRuntimeState(selectedRuntimeKey) : EMPTY_SEQUENCE_RUNTIME_STATE),
      [selectedRuntimeKey],
    ),
  );
  const selectedScenarioSequence = selectedScenario
    ? level?.eventSequence?.byScenarioId?.[selectedScenario.scenarioId] ?? []
    : [];
  const normalizedActiveStepIndex = sequenceRuntime.activeIndex >= selectedScenarioSequence.length ? 0 : sequenceRuntime.activeIndex;
  const effectiveSelectedSequenceStepId = isCreatorContext && isSequencePanelOpen
    ? (selectedSequenceStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID)
    : selectedSequenceStepId;
  /** Live gameplay step (game route): drives per-step solution capture keys, independent of timeline scrub. */
  const gameActiveStepId = !isCreatorContext && selectedScenarioSequence.length > 0
    ? selectedScenarioSequence[normalizedActiveStepIndex]?.id ?? null
    : null;
  const selectedScenarioDrawingPixelsSerial = useSyncExternalStore(
    useCallback(
      (listener) => (
        selectedScenario
          ? subscribeDrawboardPixelsForScenario(selectedScenario.scenarioId, listener)
          : () => {}
      ),
      [selectedScenario],
    ),
    useCallback(
      () => (selectedScenario ? getDrawboardPixelsSideSerials(selectedScenario.scenarioId).drawing : 0),
      [selectedScenario],
    ),
    useCallback(
      () => (selectedScenario ? getDrawboardPixelsSideSerials(selectedScenario.scenarioId).drawing : 0),
      [selectedScenario],
    ),
  );
  const autoReplayMountReady =
    drawboardCaptureMode !== "browser"
    || isCreatorContext
    || !selectedScenario
    || selectedScenarioDrawingPixelsSerial > 0;

  useEffect(() => {
    setSelectedScenarioIdForLevel(currentLevel, selectedScenario?.scenarioId ?? null);
  }, [currentLevel, selectedScenario?.scenarioId]);

  useEffect(() => {
    if (!scenarioRestoreKey || scenarios.length === 0) {
      return;
    }

    const urlLevel = Number(searchParams.get('level'));
    const urlScenarioId = searchParams.get('scenario');
    const savedScenarioId = urlLevel === currentLevel && urlScenarioId ? urlScenarioId : null;
    const nextScenarioId = savedScenarioId && scenarios.some((scenario) => scenario.scenarioId === savedScenarioId)
      ? savedScenarioId
      : scenarios[0]?.scenarioId ?? null;

    setSelectedScenarioId(nextScenarioId);
    setRestoredScenarioKey(scenarioRestoreKey);
  }, [currentLevel, scenarioRestoreKey, scenarios, searchParams]);

  useEffect(() => {
    if (!scenarioRestoreKey || restoredScenarioKey !== scenarioRestoreKey || !selectedScenario) {
      return;
    }

    const currentScenario = searchParams.get('scenario');
    if (currentScenario === selectedScenario.scenarioId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('scenario', selectedScenario.scenarioId);
    router.replace(`${normalizedPathname}?${params.toString()}`);
  }, [currentLevel, normalizedPathname, restoredScenarioKey, router, scenarioRestoreKey, searchParams, selectedScenario]);

  useEffect(() => {
    if (!selectedScenario || !isCreatorContext) {
      return;
    }
    setCreatorPreviewInteractiveForScenario(currentLevel, selectedScenario.scenarioId, creatorPreviewInteractive);
  }, [creatorPreviewInteractive, currentLevel, isCreatorContext, selectedScenario]);

  useEffect(() => {
    if (
      selectedScenario
      && autoReplayOnMount
      && selectedRuntimeKey
      && selectedScenarioSequence.length > 0
      && !hasAutoReplayMountedRun(currentLevel, selectedScenario.scenarioId)
      && !sequenceRuntime.autoReplay?.running
      && autoReplayMountReady
    ) {
      markAutoReplayMountedRun(currentLevel, selectedScenario.scenarioId);
      requestAutoReplay(selectedRuntimeKey, selectedScenarioSequence.length + 1);
    }
  }, [
    autoReplayMountReady,
    autoReplayOnMount,
    currentLevel,
    selectedRuntimeKey,
    selectedScenario,
    selectedScenarioSequence.length,
    sequenceRuntime.autoReplay?.running,
  ]);

  useAutoReplaySequence({
    runtimeKey: selectedRuntimeKey,
    levelId: currentLevel,
    scenarioId: selectedScenario?.scenarioId ?? null,
    steps: selectedScenarioSequence,
    autoReplay: sequenceRuntime.autoReplay,
  });

  const staleStepIds = useMemo(() => {
    const set = new Set<string>();
    for (const stepId of Object.keys(sequenceRuntime.stepAccuracyVersions)) {
      if (isStepStale(sequenceRuntime, stepId)) {
        set.add(stepId);
      }
    }
    return set;
  }, [sequenceRuntime]);

  const showEventRunControls =
    Boolean(selectedScenario)
    && selectedScenarioSequence.length > 0
    && sequenceRuntime.recordingMode === "idle"
    && Boolean(selectedRuntimeKey);

  const handleRunEventsClick = useCallback(() => {
    if (!selectedRuntimeKey) {
      return;
    }
    const running = getSequenceRuntimeState(selectedRuntimeKey).autoReplay?.running;
    if (running) {
      cancelAutoReplay(selectedRuntimeKey);
    } else {
      requestAutoReplay(selectedRuntimeKey, selectedScenarioSequence.length + 1);
    }
  }, [selectedRuntimeKey, selectedScenarioSequence.length]);

  const handleToggleAutoRunOnMount = useCallback(() => {
    if (!selectedScenario) {
      return;
    }
    setAutoReplayOnMount(currentLevel, selectedScenario.scenarioId, !autoReplayOnMount);
  }, [autoReplayOnMount, currentLevel, selectedScenario]);

  // Early return if level doesn't exist - parent handles loading state
  if (!level) {
    return null;
  }

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
              sequenceRuntime.autoReplay?.running && "bg-muted hover:bg-muted/90",
            )}
            onClick={handleRunEventsClick}
            aria-label={
              sequenceRuntime.autoReplay?.running
                ? "Stop scenario run"
                : "Run Scenario events"
            }
          >
            {sequenceRuntime.autoReplay?.running ? (
              <Square className="h-4 w-4 shrink-0" />
            ) : (
              <Play className="h-4 w-4 shrink-0" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-snug">
          {sequenceRuntime.autoReplay?.running
            ? "Stop scenario run"
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
              onUpdateStep={(stepId, field, value) => {
                dispatch(updateEventSequenceStep({
                  levelId: currentLevel,
                  scenarioId: selectedScenario.scenarioId,
                  stepId,
                  changes: { [field]: value },
                }));
                syncLevelFields(currentLevel - 1, ["eventSequence"]);
              }}
              selectedStepId={effectiveSelectedSequenceStepId ?? gameActiveStepId}
              onSelectStep={(stepId) => setSelectedEventSequenceStepId(currentLevel, selectedScenario.scenarioId, stepId)}
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
};
