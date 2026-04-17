"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { setMode, type Mode } from "@/store/slices/options.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { setSolutions } from "@/store/slices/solutions.slice";
import { resetSolutionUrls } from "@/store/slices/solutionUrls.slice";
import { resetDrawingUrls } from "@/store/slices/drawingUrls.slice";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { mergeSavedPoints } from "@/store/slices/points.slice";
import { getAllLevels } from "@/lib/utils/network/levels";
import { getMapLevels } from "@/lib/utils/network/maps";
import type { Level } from "@/types";
import {
  applyAssignedVariantToLevel,
  getLevelVariantAssignmentKey,
  normalizeLevelVariants,
} from "@/lib/levels/variants";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";

type SolutionsByLevelName = Record<string, { html: string; css: string; js: string }>;

function normalizeRoomStateLevels(
  levels: Array<Record<string, unknown>>,
  getYCodeSnapshot?: (editorType: "html" | "css" | "js", levelIndex: number) => string | null,
): Level[] {
  return levels.map((rawLevel, levelIndex) => {
    const levelWithoutVersions = {
      ...rawLevel,
    } as Record<string, unknown> & { versions?: unknown };
    delete levelWithoutVersions.versions;
    const nextLevel = levelWithoutVersions as unknown as Level;
    if (nextLevel.code) {
      return nextLevel;
    }
    return {
      ...nextLevel,
      code: {
        html: getYCodeSnapshot?.("html", levelIndex) ?? "",
        css: getYCodeSnapshot?.("css", levelIndex) ?? "",
        js: getYCodeSnapshot?.("js", levelIndex) ?? "",
      },
    };
  });
}

function applyGameplayVariantAssignments(
  sourceLevels: Level[],
  progressData: Record<string, unknown> | null | undefined,
): Level[] {
  const assignments =
    progressData?.variantAssignments && typeof progressData.variantAssignments === "object" && !Array.isArray(progressData.variantAssignments)
      ? progressData.variantAssignments as Record<string, string>
      : {};

  return sourceLevels.map((level, index) => {
    const assignmentKey = getLevelVariantAssignmentKey(level, index);
    return applyAssignedVariantToLevel(level, assignments[assignmentKey]);
  });
}

function variantAssignmentsSignature(progressData: Record<string, unknown> | null | undefined): string {
  const assignments =
    progressData?.variantAssignments && typeof progressData.variantAssignments === "object" && !Array.isArray(progressData.variantAssignments)
      ? progressData.variantAssignments as Record<string, string>
      : null;

  if (!assignments) {
    return "";
  }

  return JSON.stringify(
    Object.entries(assignments)
      .filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

type UseGameLevelBootstrapParams = {
  currentGame: {
    id?: string;
    mapName?: string | null;
    userId?: string | null;
    canEdit?: boolean | null;
    isOwner?: boolean | null;
    progressData?: unknown;
  } | null;
  collaboration: {
    roomId?: string | null;
    codeSyncReady?: boolean;
    initialRoomState?: {
      levels?: unknown[];
      groupStartGate?: unknown;
      yjsDocGeneration?: unknown;
    } | null;
    getYCodeSnapshot?: ((editorType: "html" | "css" | "js", levelIndex: number) => string | null) | null;
    getYText?: ((editorType: "html" | "css" | "js", levelIndex: number) => {
      toString: () => string;
      delete: (index: number, length: number) => void;
      insert: (index: number, value: string) => void;
      doc?: { transact: (fn: () => void, origin?: string) => void };
      length: number;
    } | null) | null;
    isSessionEvicted?: boolean;
  } | null;
  normalizedPathname: string;
  routeGameId?: string;
  router: { replace: (href: string) => void };
  searchParams: { get: (key: string) => string | null };
  session: {
    userId?: string | null;
    user?: { email?: string | null } | null;
  } | null;
  setIsLoadingAsync: (value: boolean) => void;
};

export function useGameLevelBootstrap({
  currentGame,
  collaboration,
  normalizedPathname,
  routeGameId,
  router,
  searchParams,
  session,
  setIsLoadingAsync,
}: UseGameLevelBootstrapParams): { isWaitingForSharedCode: boolean } {
  const dispatch = useAppDispatch();
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const isCreatorRoute = useIsCreatorRoute();
  const hasFetchedRef = useRef(false);
  const lastGameIdRef = useRef<string | null>(null);
  const lastModeRef = useRef<string | null>(null);
  const lastRoomIdRef = useRef<string | null>(null);
  const lastRoomStateSignatureRef = useRef<string | null>(null);
  const lastVariantAssignmentsSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    hasFetchedRef.current = false;
    lastGameIdRef.current = null;
    lastModeRef.current = null;
    lastRoomIdRef.current = null;
    lastRoomStateSignatureRef.current = null;
    lastVariantAssignmentsSignatureRef.current = null;
  }, [currentGame?.id, currentGame?.mapName]);

  useEffect(() => {
    const urlParams = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const isGameRoute = normalizedPathname.startsWith("/game/");
    const isGameContextRoute = isGameRoute || isCreatorRoute;
    const rawRequestedMode = (urlParams.get("mode") || "game") as Mode;
    const requestedMode: Mode = rawRequestedMode === "test" ? "game" : rawRequestedMode;

    const sessionUserId = session?.userId || session?.user?.email || "";
    const gameOwnerId = currentGame?.userId || "";
    const fallbackOwnerCheck = Boolean(gameOwnerId) && sessionUserId === gameOwnerId;
    const canEditCurrentGame = currentGame?.canEdit ?? fallbackOwnerCheck;
    const currentMode: Mode = isCreatorRoute
      ? (canEditCurrentGame ? "creator" : "game")
      : "game";

    if (isCreatorRoute && currentMode === "game" && currentGame?.id) {
      router.replace(`/game/${currentGame.id}`);
      return;
    }

    if (
      isGameContextRoute
      && (!routeGameId || !currentGame?.id || currentGame.id !== routeGameId)
    ) {
      setIsLoadingAsync(true);
      return;
    }

    if (isGameContextRoute && !currentGame?.mapName) {
      setIsLoadingAsync(true);
      return;
    }

    if (isGameContextRoute && requestedMode !== currentMode && !isCreatorRoute) {
      const normalizedParams = new URLSearchParams(urlParams.toString());
      normalizedParams.set("mode", currentMode);
      router.replace(`${normalizedPathname}?${normalizedParams.toString()}`);
    }

    const currentGameId = currentGame?.id || null;
    const roomStateSignature = collaboration?.initialRoomState
      ? JSON.stringify({
          levels: collaboration.initialRoomState.levels ?? [],
          groupStartGate: collaboration.initialRoomState.groupStartGate ?? null,
          yjsDocGeneration: collaboration.initialRoomState.yjsDocGeneration ?? null,
        })
      : null;
    const shouldUseWsCodeSource = isGameContextRoute && Boolean(collaboration?.roomId);

    if (shouldUseWsCodeSource && (!collaboration?.codeSyncReady || !collaboration?.initialRoomState)) {
      return;
    }

    const gameChanged = lastGameIdRef.current !== currentGameId;
    const modeChanged = lastModeRef.current !== currentMode;
    const roomChanged = lastRoomIdRef.current !== (collaboration?.roomId || null);
    const roomStateChanged =
      shouldUseWsCodeSource
      && currentMode === "game"
      && lastRoomStateSignatureRef.current !== roomStateSignature;
    const currentVariantAssignments = currentMode === "game"
      ? variantAssignmentsSignature(
          currentGame?.progressData && typeof currentGame.progressData === "object"
            ? currentGame.progressData as Record<string, unknown>
            : null,
        )
      : "";
    const variantAssignmentsChanged =
      currentMode === "game"
      && lastVariantAssignmentsSignatureRef.current !== currentVariantAssignments;

    if (
      hasFetchedRef.current
      && !gameChanged
      && !modeChanged
      && !roomChanged
      && !roomStateChanged
      && !variantAssignmentsChanged
    ) {
      return;
    }

    hasFetchedRef.current = true;
    lastGameIdRef.current = currentGameId;
    lastModeRef.current = currentMode;
    lastRoomIdRef.current = collaboration?.roomId || null;
    lastRoomStateSignatureRef.current = roomStateSignature;
    lastVariantAssignmentsSignatureRef.current = currentVariantAssignments;

    const isCreator = currentMode === "creator";

    const applyLevels = async (levelsSnapshot: Level[], mapName: string) => {
      try {
        let fetchedLevels = levelsSnapshot;
        let nextLevels = fetchedLevels;
        let solutions: SolutionsByLevelName = {};

        if (!isCreator) {
          const gameProgressData =
            currentGame?.progressData && typeof currentGame.progressData === "object"
              ? currentGame.progressData as Record<string, unknown>
              : null;
          fetchedLevels = applyGameplayVariantAssignments(fetchedLevels, gameProgressData);
          nextLevels = fetchedLevels;
        } else {
          fetchedLevels = fetchedLevels.map((level) => normalizeLevelVariants(level, "creator"));
          nextLevels = fetchedLevels;
        }

        solutions = nextLevels.reduce((acc, level) => {
          acc[level.name] = {
            html: level.solution.html,
            css: level.solution.css,
            js: level.solution.js,
          };
          return acc;
        }, {} as SolutionsByLevelName);

        if (isCreator) {
          nextLevels = nextLevels.map((level) => ({
            ...level,
            solution: {
              html: solutions[level.name]?.html || "",
              css: solutions[level.name]?.css || "",
              js: solutions[level.name]?.js || "",
            },
          }));
        }

        if (nextLevels.length === 0 && !shouldUseWsCodeSource) {
          const emptyLevel: Level = {
            name: "template",
            scenarios: [],
            buildingBlocks: { pictures: [], colors: [] },
            code: { html: "", css: "", js: "" },
            solution: { html: "", css: "", js: "" },
            accuracy: 0,
            week: mapName,
            percentageTreshold: 70,
            percentageFullPointsTreshold: 95,
            pointsThresholds: [
              { accuracy: 70, pointsPercent: 25 },
              { accuracy: 85, pointsPercent: 60 },
              { accuracy: 95, pointsPercent: 100 },
            ],
            difficulty: "easy",
            instructions: [],
            question_and_answer: { question: "", answer: "" },
            help: { description: "Start coding!", images: [], usefullCSSProperties: [] },
            timeData: {
              startTime: 0,
              pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" },
            },
            eventSequence: { byScenarioId: {} },
            events: [],
            interactionArtifacts: { byScenarioId: {} },
            interactive: false,
            showScenarioModel: true,
            showHotkeys: false,
            showModelPicture: true,
            lockCSS: false,
            lockHTML: false,
            lockJS: false,
            completed: "",
            points: 0,
            maxPoints: 100,
            confettiSprinkled: false,
          };
          fetchedLevels = [emptyLevel];
          nextLevels = [normalizeLevelVariants(emptyLevel, isCreator ? "creator" : "game")];
          fetchedLevels = nextLevels;
          solutions[emptyLevel.name] = { html: "", css: "", js: "" };
        }

        dispatch(updateWeek({
          levels: nextLevels,
          mapName,
          gameId: currentGame?.id,
          mode: currentMode,
          forceFresh: modeChanged || variantAssignmentsChanged,
        }));
        dispatch(setSolutions(solutions));
        dispatch(resetSolutionUrls());
        dispatch(resetDrawingUrls());
        setAllLevels(fetchedLevels);

        if (!isCreator && collaboration?.getYText) {
          nextLevels.forEach((level, levelIndex) => {
            (["html", "css", "js"] as const).forEach((editorType) => {
              const yText = collaboration.getYText?.(editorType, levelIndex);
              const nextContent = level.code[editorType] ?? "";
              if (!yText || yText.toString() === nextContent) {
                return;
              }
              const applyChange = () => {
                yText.delete(0, yText.length);
                if (nextContent.length > 0) {
                  yText.insert(0, nextContent);
                }
              };
              if (yText.doc) {
                yText.doc.transact(applyChange, "variant-assignment");
              } else {
                applyChange();
              }
            });
          });
        }

        await dispatch(initializePointsFromLevelsStateThunk());

        const pointsByLevel = currentGame?.progressData
          && typeof currentGame.progressData === "object"
          && "pointsByLevel" in currentGame.progressData
            ? (currentGame.progressData as {
                pointsByLevel?: Record<string, {
                  points?: number;
                  maxPoints?: number;
                  accuracy?: number;
                  bestTime?: string;
                  scenarios?: { scenarioId: string; accuracy: number }[];
                }>;
              }).pointsByLevel
            : undefined;
        if (pointsByLevel && Object.keys(pointsByLevel).length > 0) {
          dispatch(mergeSavedPoints(pointsByLevel));
        }

        const savedLevel = Number(searchParams.get("level"));
        const nextCurrentLevel = Number.isFinite(savedLevel) && savedLevel >= 1
          ? Math.min(Math.max(1, savedLevel), Math.max(1, nextLevels.length))
          : 1;
        dispatch(setCurrentLevel(nextCurrentLevel));
        setIsLoadingAsync(false);
      } catch (error) {
        console.error("Error applying levels:", error);
        setIsLoadingAsync(false);
      }
    };

    setIsLoadingAsync(true);
    void dispatch(setMode(currentMode));

    if (shouldUseWsCodeSource && currentGame?.mapName) {
      const roomStateLevels = normalizeRoomStateLevels(
        (collaboration?.initialRoomState?.levels || []) as Array<Record<string, unknown>>,
        collaboration?.getYCodeSnapshot || undefined,
      );
      void applyLevels(roomStateLevels, currentGame.mapName);
      return;
    }

    const mapToFetch = isGameContextRoute
      ? currentGame?.mapName || "all"
      : urlParams.get("map") || "all";

    const fetchLevels = async () => {
      try {
        const fetchedLevels = !currentGame?.id && mapToFetch === "all"
          ? await getAllLevels()
          : await getMapLevels(mapToFetch);
        await applyLevels(fetchedLevels, mapToFetch);
      } catch (error) {
        console.error("Error fetching levels:", error);
        setIsLoadingAsync(false);
      }
    };

    void fetchLevels();
  }, [
    collaboration?.codeSyncReady,
    collaboration?.getYCodeSnapshot,
    collaboration?.getYText,
    collaboration?.initialRoomState,
    collaboration?.roomId,
    currentGame,
    currentGame?.id,
    currentGame?.mapName,
    currentGame?.progressData,
    currentGame?.userId,
    dispatch,
    isCreatorRoute,
    normalizedPathname,
    routeGameId,
    router,
    searchParams,
    session?.user?.email,
    session?.userId,
    setIsLoadingAsync,
  ]);

  const isWaitingForSharedCode =
    options.mode === "game"
    && Boolean(collaboration?.roomId)
    && ((!collaboration?.isSessionEvicted && !collaboration?.codeSyncReady) || !collaboration?.initialRoomState);

  return { isWaitingForSharedCode };
}
