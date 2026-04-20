"use client";

/**
 * ScenarioContext — selection + full runtime state for the current scenario.
 *
 * Owns "which scenario of the level is the user looking at" AND everything
 * scenario-scoped that follows from it: sequence runtime (replay, record,
 * batch, journey, diagnostics), focused step ids, scenario accuracy
 * aggregate + staleness, run-control visibility, scenario actions.
 *
 * Hierarchy + flow:
 * GameContext -> LevelContext -> ScenarioContext -> EventsContext -> EventContext
 *
 * ScenarioContext is the handoff boundary between scenario runtime and event
 * UI state. It exposes a scenario-scoped key + scenario-event read/write API
 * so child contexts do not depend on replay/runtime internals.
 *
 * Must be mounted inside LevelProvider. Per-event state lives in EventContext.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { stripBasePath } from "@/lib/apiUrl";
import { buildArtifactKey, type DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";
import type { scenario } from "@/types";
import type { RootState } from "@/store/store";
import type { SingleLayoutControl } from "./SidebySideArt";
import { buildDrawingArtifactDescriptor } from "@/events/hooks/useScenarioArtifacts";
import { INITIAL_EVENT_SEQUENCE_STEP_ID } from "@/events/core/eventSequenceReplayTypes";
import {
  EMPTY_SCENARIO_ACCURACY_AGGREGATE,
  type ScenarioAccuracyAggregate,
} from "@/events/core/aggregateEventSequenceAccuracy";
import {
  useScenarioRuntimeState,
  type ScenarioRuntimeActions,
  type ScenarioRuntimeState,
} from "@/events/hooks/useScenarioRuntimeState";
import { useEventsAutoReplayOrchestration } from "@/events/hooks/useEventsAutoReplayOrchestration";
import { useScenarioDrawingPixelsSerial } from "@/events/hooks/useScenarioDrawingPixelsSerial";
import { useScenarioEventBridge } from "@/events/hooks/useScenarioEventBridge";
import { useLevelContext } from "./LevelContext";
import { useGameContext } from "./GameContext";

function getScenarioUiKey(levelId: number, scenarioId: string): string {
  return `${levelId}:${scenarioId}`;
}

type ScenarioSelectionValue = {
  creatorPreviewInteractive: boolean;
  selectedScenario: scenario | null;
  selectedScenarioId: string | null;
  scenarioScopeKey: string | null;
  selectedScenarioIndex: number;
  selectedScenarioSequence: RootState["levels"][number]["eventSequence"]["byScenarioId"][string];
  selectedScenarioDrawingUrl?: string;
  scenarioEventSnapshot: {
    stepId: string;
    solutionUrl: string | null;
    diffUrl: string | null;
    solutionUrlStale: boolean;
    accuracyRaw: number | null;
  };
  scenarioAccuracy: ScenarioAccuracyAggregate;
  singleLayoutControl: SingleLayoutControl | null;
  updateScenarioEventSolutionUrl: (url: string, stepId?: string | null) => void;
  updateScenarioEventDiffUrl: (url: string, stepId?: string | null) => void;
  updateScenarioEventAccuracy: (accuracy: number, stepId?: string | null) => void;
  setCreatorPreviewInteractiveForScenario: (scenarioId: string, interactive: boolean) => void;
  setSelectedScenarioId: (scenarioId: string) => void;
  setSingleLayoutControl: (control: SingleLayoutControl | null) => void;
  goToScenario: (nextIndex: number) => void;
};

export type ScenarioContextValue = ScenarioSelectionValue & ScenarioRuntimeState & ScenarioRuntimeActions;

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const { currentLevel, level, scenarios, scenarioAccuraciesById } = useLevelContext();
  const { drawboardCaptureMode, isCreatorContext } = useGameContext();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ gameId?: string }>();
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string | undefined>);
  const currentGameId = useGameStore((state) => state.currentGameId);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [restoredScenarioKey, setRestoredScenarioKey] = useState<string | null>(null);
  const [singleLayoutControl, setSingleLayoutControl] = useState<SingleLayoutControl | null>(null);
  const [creatorPreviewInteractiveByScenario, setCreatorPreviewInteractiveByScenario] = useState<Record<string, boolean>>({});

  const routeGameIdParam = params?.gameId;
  const routeGameId = Array.isArray(routeGameIdParam) ? routeGameIdParam[0] : routeGameIdParam;
  const scenarioRestoreKey = routeGameId ? `${routeGameId}:${currentLevel}` : null;

  const selectedScenario = useMemo(() => {
    if (scenarios.length === 0) return null;
    return scenarios.find((item) => item.scenarioId === selectedScenarioId) ?? scenarios[0];
  }, [scenarios, selectedScenarioId]);

  const selectedScenarioIndex = selectedScenario
    ? scenarios.findIndex((item) => item.scenarioId === selectedScenario.scenarioId)
    : -1;

  const platformBucket = useMemo(
    () => (drawboardCaptureMode === "browser" ? getBrowserPlatformBucket() : null),
    [drawboardCaptureMode],
  );

  const selectedScenarioDrawingArtifactDescriptor = useMemo<DrawboardArtifactDescriptor | null>(() => {
    if (!level || !selectedScenario) return null;
    return buildDrawingArtifactDescriptor({
      currentGameId,
      drawboardCaptureMode,
      level,
      platformBucket,
      scenario: selectedScenario,
    });
  }, [currentGameId, drawboardCaptureMode, level, platformBucket, selectedScenario]);

  const selectedScenarioDrawingUrl = useMemo(() => {
    if (!selectedScenarioDrawingArtifactDescriptor) return undefined;
    return drawingUrls[buildArtifactKey(selectedScenarioDrawingArtifactDescriptor)];
  }, [drawingUrls, selectedScenarioDrawingArtifactDescriptor]);

  const selectedScenarioSequence = useMemo(
    () => (selectedScenario ? level?.eventSequence?.byScenarioId?.[selectedScenario.scenarioId] ?? [] : []),
    [level?.eventSequence?.byScenarioId, selectedScenario],
  );

  const creatorPreviewInteractive = useMemo(() => {
    if (!selectedScenario) return false;
    const key = getScenarioUiKey(currentLevel, selectedScenario.scenarioId);
    const stored = creatorPreviewInteractiveByScenario[key];
    if (stored !== undefined) return stored;
    if (selectedScenarioSequence.length > 0) return true;
    return !selectedScenarioDrawingUrl;
  }, [
    creatorPreviewInteractiveByScenario,
    currentLevel,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioSequence.length,
  ]);

  const goToScenario = useCallback((nextIndex: number) => {
    const nextScenario = scenarios[nextIndex];
    if (!nextScenario) return;
    setSelectedScenarioId(nextScenario.scenarioId);
  }, [scenarios]);

  const setCreatorPreviewInteractiveForScenario = useCallback((scenarioId: string, interactive: boolean) => {
    const key = getScenarioUiKey(currentLevel, scenarioId);
    setCreatorPreviewInteractiveByScenario((current) => ({ ...current, [key]: interactive }));
  }, [currentLevel]);

  useEffect(() => {
    if (!scenarioRestoreKey || scenarios.length === 0) return;

    const urlLevel = Number(searchParams.get("level"));
    const urlScenarioId = searchParams.get("scenario");
    const savedScenarioId = urlLevel === currentLevel && urlScenarioId ? urlScenarioId : null;
    const nextScenarioId = savedScenarioId && scenarios.some((item) => item.scenarioId === savedScenarioId)
      ? savedScenarioId
      : scenarios[0]?.scenarioId ?? null;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSelectedScenarioId(nextScenarioId);
      setRestoredScenarioKey(scenarioRestoreKey);
    });
    return () => { cancelled = true; };
  }, [currentLevel, scenarioRestoreKey, scenarios, searchParams]);

  useEffect(() => {
    if (!scenarioRestoreKey || restoredScenarioKey !== scenarioRestoreKey || !selectedScenario) return;
    const currentScenario = searchParams.get("scenario");
    if (currentScenario === selectedScenario.scenarioId) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("scenario", selectedScenario.scenarioId);
    router.replace(`${normalizedPathname}?${next.toString()}`);
  }, [normalizedPathname, restoredScenarioKey, router, scenarioRestoreKey, searchParams, selectedScenario]);

  const scenarioAccuracy = selectedScenario
    ? scenarioAccuraciesById[selectedScenario.scenarioId] ?? EMPTY_SCENARIO_ACCURACY_AGGREGATE
    : EMPTY_SCENARIO_ACCURACY_AGGREGATE;

  const runtime = useScenarioRuntimeState({
    currentLevel,
    isCreatorContext,
    selectedScenario,
    selectedScenarioSequence,
    scenarioAccuracy,
  });

  const currentEventStepId = runtime.focusedEventStepId ?? INITIAL_EVENT_SEQUENCE_STEP_ID;
  const eventBridge = useScenarioEventBridge({
    selectedScenario,
    currentEventStepId,
    selectedRuntimeKey: runtime.selectedRuntimeKey,
  });

  // Auto-replay orchestration belongs to scenario runtime — mount here so
  // EventContext no longer needs level context to run it.
  const selectedScenarioDrawingPixelsSerial = useScenarioDrawingPixelsSerial(runtime.selectedRuntimeKey);
  const autoReplayMountReady =
    drawboardCaptureMode !== "browser"
    || isCreatorContext
    || !selectedScenario
    || selectedScenarioDrawingPixelsSerial > 0;

  useEventsAutoReplayOrchestration({
    autoReplayMountReady,
    currentLevel,
    selectedRuntimeKey: runtime.selectedRuntimeKey,
    selectedScenarioId: selectedScenario?.scenarioId ?? null,
    selectedScenarioSequence,
  });

  const value = useMemo<ScenarioContextValue>(() => ({
    creatorPreviewInteractive,
    scenarioEventSnapshot: eventBridge.current,
    goToScenario,
    scenarioAccuracy,
    scenarioScopeKey: runtime.selectedRuntimeKey,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioId,
    selectedScenarioIndex,
    selectedScenarioSequence,
    setCreatorPreviewInteractiveForScenario,
    setSelectedScenarioId,
    setSingleLayoutControl,
    singleLayoutControl,
    updateScenarioEventSolutionUrl: eventBridge.handlers.setCurrentEventSolutionUrl,
    updateScenarioEventDiffUrl: eventBridge.handlers.setCurrentEventDiffUrl,
    updateScenarioEventAccuracy: eventBridge.handlers.setCurrentEventAccuracy,
    ...runtime,
  }), [
    creatorPreviewInteractive,
    eventBridge.current,
    eventBridge.handlers.setCurrentEventAccuracy,
    eventBridge.handlers.setCurrentEventDiffUrl,
    eventBridge.handlers.setCurrentEventSolutionUrl,
    goToScenario,
    runtime,
    scenarioAccuracy,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioId,
    selectedScenarioIndex,
    selectedScenarioSequence,
    setCreatorPreviewInteractiveForScenario,
    singleLayoutControl,
  ]);

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenarioContext(): ScenarioContextValue {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error("useScenarioContext must be used within ScenarioProvider");
  }
  return context;
}
