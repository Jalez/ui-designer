"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameStore } from "@/components/default/games";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { stripBasePath } from "@/lib/apiUrl";
import { buildArtifactKey, type DrawboardArtifactDescriptor } from "@/lib/drawboard/artifactCache";
import { drawingArtifactFingerprint } from "@/lib/drawboard/artifactFingerprint";
import { getBrowserPlatformBucket } from "@/lib/drawboard/platformBucket";
import { setSelectedScenarioIdForLevel } from "@/lib/drawboard/eventSequenceState";
import type { scenario } from "@/types";
import type { RootState } from "@/store/store";
import type { SingleLayoutControl } from "./SidebySideArt";

const EMPTY_SCENARIOS: scenario[] = [];

type ScenarioContextValue = {
  currentLevel: number;
  drawboardCaptureMode: "browser" | "playwright";
  isCreatorContext: boolean;
  level: RootState["levels"][number] | undefined;
  scenarios: scenario[];
  selectedScenario: scenario | null;
  selectedScenarioId: string | null;
  selectedScenarioIndex: number;
  selectedScenarioSequence: RootState["levels"][number]["eventSequence"]["byScenarioId"][string];
  selectedScenarioDrawingUrl?: string;
  showHotkeys: boolean;
  singleLayoutControl: SingleLayoutControl | null;
  setSelectedScenarioId: (scenarioId: string) => void;
  setSingleLayoutControl: (control: SingleLayoutControl | null) => void;
  goToScenario: (nextIndex: number) => void;
};

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname ?? "");
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ gameId?: string }>();
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const drawingUrls = useAppSelector((state) => state.drawingUrls as Record<string, string | undefined>);
  const currentGameId = useGameStore((state) => state.currentGameId);
  const { drawboardCaptureMode } = useGameRuntimeConfig();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [restoredScenarioKey, setRestoredScenarioKey] = useState<string | null>(null);
  const [singleLayoutControl, setSingleLayoutControl] = useState<SingleLayoutControl | null>(null);

  const isCreatorContext = pathname?.startsWith("/creator/") ?? false;
  const routeGameIdParam = params?.gameId;
  const routeGameId = Array.isArray(routeGameIdParam) ? routeGameIdParam[0] : routeGameIdParam;
  const scenarios = level?.scenarios ?? EMPTY_SCENARIOS;
  const showHotkeys = level?.showHotkeys ?? false;
  const scenarioRestoreKey = routeGameId ? `${routeGameId}:${currentLevel}` : null;

  const selectedScenario = useMemo(() => {
    if (scenarios.length === 0) {
      return null;
    }

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

  const selectedScenarioSequence = useMemo(
    () => (selectedScenario ? level?.eventSequence?.byScenarioId?.[selectedScenario.scenarioId] ?? [] : []),
    [level?.eventSequence?.byScenarioId, selectedScenario],
  );

  const goToScenario = useCallback((nextIndex: number) => {
    const nextScenario = scenarios[nextIndex];
    if (!nextScenario) {
      return;
    }

    setSelectedScenarioId(nextScenario.scenarioId);
  }, [scenarios]);

  useEffect(() => {
    setSelectedScenarioIdForLevel(currentLevel, selectedScenario?.scenarioId ?? null);
  }, [currentLevel, selectedScenario?.scenarioId]);

  useEffect(() => {
    if (!scenarioRestoreKey || scenarios.length === 0) {
      return;
    }

    const urlLevel = Number(searchParams.get("level"));
    const urlScenarioId = searchParams.get("scenario");
    const savedScenarioId = urlLevel === currentLevel && urlScenarioId ? urlScenarioId : null;
    const nextScenarioId = savedScenarioId && scenarios.some((item) => item.scenarioId === savedScenarioId)
      ? savedScenarioId
      : scenarios[0]?.scenarioId ?? null;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      setSelectedScenarioId(nextScenarioId);
      setRestoredScenarioKey(scenarioRestoreKey);
    });

    return () => {
      cancelled = true;
    };
  }, [currentLevel, scenarioRestoreKey, scenarios, searchParams]);

  useEffect(() => {
    if (!scenarioRestoreKey || restoredScenarioKey !== scenarioRestoreKey || !selectedScenario) {
      return;
    }

    const currentScenario = searchParams.get("scenario");
    if (currentScenario === selectedScenario.scenarioId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("scenario", selectedScenario.scenarioId);
    router.replace(`${normalizedPathname}?${params.toString()}`);
  }, [normalizedPathname, restoredScenarioKey, router, scenarioRestoreKey, searchParams, selectedScenario]);

  const value = useMemo<ScenarioContextValue>(() => ({
    currentLevel,
    drawboardCaptureMode,
    goToScenario,
    isCreatorContext,
    level,
    scenarios,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioId,
    selectedScenarioIndex,
    selectedScenarioSequence,
    setSelectedScenarioId,
    setSingleLayoutControl,
    showHotkeys,
    singleLayoutControl,
  }), [
    currentLevel,
    drawboardCaptureMode,
    isCreatorContext,
    level,
    scenarios,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioId,
    selectedScenarioIndex,
    selectedScenarioSequence,
    showHotkeys,
    singleLayoutControl,
    goToScenario,
  ]);

  return (
    <ScenarioContext.Provider value={value}>
      {children}
    </ScenarioContext.Provider>
  );
}

export function useScenarioContext() {
  const context = useContext(ScenarioContext);
  if (!context) {
    throw new Error("useScenarioContext must be used within ScenarioProvider");
  }
  return context;
}
