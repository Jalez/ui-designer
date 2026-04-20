"use client";

/**
 * ScenarioContext — scenario selection + per-scenario selection UI.
 *
 * Owns "which scenario of the level is the user currently looking at":
 *   selectedScenarioId, selectedScenario, selectedScenarioIndex,
 *   selectedScenarioSequence, selection actions, single-layout control,
 *   creator preview-interactive toggle, URL restore.
 *
 * Must be mounted inside LevelProvider. Level-scoped facts (currentLevel,
 * level data, isCreatorContext, etc.) live in LevelContext.
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
import { useLevelContext } from "./LevelContext";

function getScenarioUiKey(levelId: number, scenarioId: string): string {
  return `${levelId}:${scenarioId}`;
}

type ScenarioContextValue = {
  creatorPreviewInteractive: boolean;
  selectedScenario: scenario | null;
  selectedScenarioId: string | null;
  selectedScenarioIndex: number;
  selectedScenarioSequence: RootState["levels"][number]["eventSequence"]["byScenarioId"][string];
  selectedScenarioDrawingUrl?: string;
  singleLayoutControl: SingleLayoutControl | null;
  setCreatorPreviewInteractiveForScenario: (scenarioId: string, interactive: boolean) => void;
  setSelectedScenarioId: (scenarioId: string) => void;
  setSingleLayoutControl: (control: SingleLayoutControl | null) => void;
  goToScenario: (nextIndex: number) => void;
};

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const { currentLevel, drawboardCaptureMode, level, scenarios } = useLevelContext();
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

    return buildDrawingArtifactDescriptor({
      currentGameId,
      drawboardCaptureMode,
      level,
      platformBucket,
      scenario: selectedScenario,
    });
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

  const creatorPreviewInteractive = useMemo(() => {
    if (!selectedScenario) {
      return false;
    }
    const key = getScenarioUiKey(currentLevel, selectedScenario.scenarioId);
    const stored = creatorPreviewInteractiveByScenario[key];
    if (stored !== undefined) {
      return stored;
    }
    if (selectedScenarioSequence.length > 0) {
      return true;
    }
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
    if (!nextScenario) {
      return;
    }

    setSelectedScenarioId(nextScenario.scenarioId);
  }, [scenarios]);

  const setCreatorPreviewInteractiveForScenario = useCallback((scenarioId: string, interactive: boolean) => {
    const key = getScenarioUiKey(currentLevel, scenarioId);
    setCreatorPreviewInteractiveByScenario((current) => ({
      ...current,
      [key]: interactive,
    }));
  }, [currentLevel]);

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
    creatorPreviewInteractive,
    goToScenario,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioId,
    selectedScenarioIndex,
    selectedScenarioSequence,
    setCreatorPreviewInteractiveForScenario,
    setSelectedScenarioId,
    setSingleLayoutControl,
    singleLayoutControl,
  }), [
    creatorPreviewInteractive,
    selectedScenario,
    selectedScenarioDrawingUrl,
    selectedScenarioId,
    selectedScenarioIndex,
    selectedScenarioSequence,
    setCreatorPreviewInteractiveForScenario,
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
