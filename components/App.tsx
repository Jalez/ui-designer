'use client';

import Editors from "./Editors/Editors";
import { ArtBoards } from "./ArtBoards/ArtBoards";
import { DrawboardNavbarCaptureProvider } from "./ArtBoards/DrawboardNavbarCaptureContext";
import { LevelUpdater } from "./General/LevelUpdater";
import { GameContainer } from "./General/GameContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { Footer } from "./Footer/Footer";
import { Navbar } from "./Navbar/Navbar";
import { setMode } from "@/store/slices/options.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { Level } from "@/types";
import { setSolutions } from "@/store/slices/solutions.slice";
import { resetSolutionUrls } from "@/store/slices/solutionUrls.slice";
import { resetDrawingUrls } from "@/store/slices/drawingUrls.slice";
import { getAllLevels } from "@/lib/utils/network/levels";
import { getMapLevels } from "@/lib/utils/network/maps";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { mergeSavedPoints } from "@/store/slices/points.slice";
import { ProgressionSync } from "./General/ProgressionSync";
import { ProgressPersistence } from "./General/ProgressPersistence";
import { LevelMetaSync } from "./General/LevelMetaSync";
import { GameplayTelemetryTracker } from "./General/GameplayTelemetryTracker";
import { GameboardTourController } from "./General/GameboardTourController";
import { useGameStore } from "./default/games";
import { useSession } from "next-auth/react";
import type { Mode } from "@/store/slices/options.slice";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { stripBasePath } from "@/lib/apiUrl";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useDefaultLayout } from "react-resizable-panels";
import type { PanelImperativeHandle } from "react-resizable-panels";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { CreatorAiChatDrawer } from "@/components/creator-ai/CreatorAiChatDrawer";
import { ScenarioProvider } from "@/components/ArtBoards/ScenarioContext";

import { applyAssignedVariantToLevel, getLevelVariantAssignmentKey, normalizeLevelVariants } from "@/lib/levels/variants";

export const allLevels: Level[] = [];
type SolutionsByLevelName = Record<string, { html: string; css: string; js: string }>;
const MIN_EDITOR_PANE_WIDTH = 420;
const ARTBOARD_PANE_CHROME_WIDTH = 56;
const HORIZONTAL_LAYOUT_ID = "game-layout-horizontal";
const VERTICAL_LAYOUT_ID = "game-layout-vertical";
const STABLE_LAYOUT_GROUP_ID = "game-layout-stable";

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

function App() {
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const [isLoading, setIsLoading] = useState(true);
  const currentGame = useGameStore((state) => {
    const { currentGameId, games } = state;
    if (!currentGameId) return null;
    return games.find((g) => g.id === currentGameId) ?? null;
  });
  const { data: session } = useSession();
  const collaboration = useOptionalCollaboration();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);
  /** Sidebar host for creator workbench only; game route editors use navbar menus instead. */
  const showEditorWorkbenchSidebar =
    canEditCurrentGame && normalizedPathname.startsWith("/creator/");
  const params = useParams<{ gameId?: string }>();
  const mode = searchParams.get('mode');
  const routeGameIdParam = params?.gameId;
  const routeGameId = Array.isArray(routeGameIdParam) ? routeGameIdParam[0] : routeGameIdParam;
  const hasFetchedRef = useRef(false);
  const lastGameIdRef = useRef<string | null>(null);
  const lastModeRef = useRef<string | null>(null);
  const lastRoomIdRef = useRef<string | null>(null);
  const lastRoomStateSignatureRef = useRef<string | null>(null);
  const lastVariantAssignmentsSignatureRef = useRef<string | null>(null);
  const restoredRouteProgressScopeRef = useRef<string | null>(null);
  const contentRowRef = useRef<HTMLDivElement | null>(null);
  const editorPanelRef = useRef<PanelImperativeHandle | null>(null);
  const panelGroupRef = useRef<GroupImperativeHandle | null>(null);
  const [contentRowWidth, setContentRowWidth] = useState(0);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);
  const setIsLoadingAsync = (value: boolean) => {
    queueMicrotask(() => setIsLoading(value));
  };
  const isRouteWithProgress = normalizedPathname.startsWith("/creator/") || normalizedPathname.startsWith("/game/");
  const maxScenarioWidth = useMemo(() => {
    const activeLevel = levels[currentLevel - 1];
    const scenarios = activeLevel?.scenarios ?? [];

    if (scenarios.length === 0) {
      return 0;
    }

    return scenarios.reduce(
      (maxWidth, scenario) => Math.max(maxWidth, scenario.dimensions.width),
      0
    );
  }, [currentLevel, levels]);
  const shouldStackGameLayout =
    contentRowWidth > 0
      ? contentRowWidth < maxScenarioWidth + ARTBOARD_PANE_CHROME_WIDTH + MIN_EDITOR_PANE_WIDTH
      : false;
  const groupOrientation = shouldStackGameLayout ? "vertical" : "horizontal";
  const horizontalLayout = useDefaultLayout({
    id: HORIZONTAL_LAYOUT_ID,
    panelIds: ["artboards", "editor"],
  });
  const verticalLayout = useDefaultLayout({
    id: VERTICAL_LAYOUT_ID,
    panelIds: ["artboards", "editor"],
  });
  const activeLayout = shouldStackGameLayout ? verticalLayout : horizontalLayout;
  const activeLayoutId = shouldStackGameLayout ? VERTICAL_LAYOUT_ID : HORIZONTAL_LAYOUT_ID;

  useEffect(() => {
    restoredRouteProgressScopeRef.current = null;
  }, [routeGameId]);

  useEffect(() => {
    if (!isRouteWithProgress || !routeGameId || levels.length === 0) {
      return;
    }

    if (restoredRouteProgressScopeRef.current === routeGameId) {
      return;
    }

    const savedLevel = Number(searchParams.get('level'));

    restoredRouteProgressScopeRef.current = routeGameId;

    if (!Number.isFinite(savedLevel) || savedLevel < 1) {
      return;
    }

    const normalizedLevel = Math.min(Math.max(1, savedLevel), levels.length);
    if (normalizedLevel !== currentLevel) {
      dispatch(setCurrentLevel(normalizedLevel));
    }
  }, [currentLevel, dispatch, isRouteWithProgress, levels.length, routeGameId, searchParams]);

  useEffect(() => {
    if (!isRouteWithProgress || !routeGameId || levels.length === 0) {
      return;
    }

    if (restoredRouteProgressScopeRef.current !== routeGameId) {
      return;
    }

    const clampedLevel = Math.min(Math.max(1, currentLevel), levels.length);
    if (searchParams.get('level') === String(clampedLevel)) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('level', String(clampedLevel));
    router.replace(`${normalizedPathname}?${params.toString()}`);
  }, [currentLevel, isRouteWithProgress, levels.length, normalizedPathname, routeGameId, router, searchParams]);

  useEffect(() => {
    const nextLayout = activeLayout.defaultLayout;
    if (!panelGroupRef.current || !nextLayout) {
      return;
    }

    const currentLayout = panelGroupRef.current.getLayout();
    const currentArtboards = currentLayout.artboards;
    const currentEditor = currentLayout.editor;
    if (
      typeof currentArtboards === "number"
      && typeof currentEditor === "number"
      && Math.abs(currentArtboards - nextLayout.artboards) < 0.001
      && Math.abs(currentEditor - nextLayout.editor) < 0.001
    ) {
      return;
    }

    panelGroupRef.current.setLayout(nextLayout);
  }, [activeLayout.defaultLayout, activeLayoutId]);

  useEffect(() => {
    const target = contentRowRef.current;
    if (!target || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateWidth = () => {
      setContentRowWidth(target.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [
    isLoading,
    levels.length,
    collaboration?.roomId,
    collaboration?.codeSyncReady,
    collaboration?.initialRoomState,
    collaboration?.getYCodeSnapshot,
  ]);

  useEffect(() => {
    hasFetchedRef.current = false;
    lastGameIdRef.current = null;
    lastModeRef.current = null;
    lastRoomIdRef.current = null;
    lastRoomStateSignatureRef.current = null;
    lastVariantAssignmentsSignatureRef.current = null;
    if (currentGame?.id) {
      console.log("[App] Game context changed, forcing reload", {
        gameId: currentGame.id,
        mapName: currentGame.mapName,
      });
    }
  }, [currentGame?.id, currentGame?.mapName]);

  useEffect(() => {
    // Get current URL params
    const urlParams = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const isGameRoute = normalizedPathname.startsWith('/game/');
    const isCreatorRoute = normalizedPathname.startsWith('/creator/');
    const isGameContextRoute = isGameRoute || isCreatorRoute;
    const defaultMode: Mode = "game";
    const rawRequestedMode = (urlParams.get("mode") || defaultMode) as Mode;
    const requestedMode: Mode = rawRequestedMode === "test" ? "game" : rawRequestedMode;

    const sessionUserId = session?.userId || session?.user?.email || "";
    const gameOwnerId = currentGame?.userId || "";
    const fallbackOwnerCheck = !!gameOwnerId && sessionUserId === gameOwnerId;
    const canEditCurrentGame = currentGame?.canEdit ?? fallbackOwnerCheck;

    const currentMode: Mode = isCreatorRoute
      ? (canEditCurrentGame ? "creator" : "game")
      : "game";

    if (isCreatorRoute && currentMode === "game" && currentGame?.id) {
      router.replace(`/game/${currentGame.id}?mode=game`);
      return;
    }

    if ((isGameRoute || isCreatorRoute) && (!routeGameId || !currentGame?.id || currentGame.id !== routeGameId)) {
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
    const shouldUseWsCodeSource =
      isGameContextRoute &&
      Boolean(collaboration?.roomId);

    if (shouldUseWsCodeSource && (!collaboration?.codeSyncReady || !collaboration?.initialRoomState)) {
      // IMPORTANT: Don't flip the global levels loader on/off based on transient
      // websocket readiness. The UI already shows "Syncing shared code..." via
      // isWaitingForSharedCode, and toggling isLoading here can leave the app
      // stuck after backend restarts until a full refresh.
      return;
    }

    // Check if game or mode changed
    const gameChanged = lastGameIdRef.current !== currentGameId;
    const modeChanged = lastModeRef.current !== currentMode;
    const roomChanged = lastRoomIdRef.current !== (collaboration?.roomId || null);
    // Room state changes only matter in gameplay mode where the websocket room
    // is the authoritative source. In creator mode we only use the initial
    // room-state snapshot to bootstrap the editors, then let Yjs drive changes.
    const roomStateChanged =
      shouldUseWsCodeSource
      && currentMode === "game"
      && lastRoomStateSignatureRef.current !== roomStateSignature;
    const currentVariantAssignmentsSignature =
      currentMode === "game"
        ? variantAssignmentsSignature(
            currentGame?.progressData && typeof currentGame.progressData === "object"
              ? currentGame.progressData
              : null,
          )
        : "";
    const variantAssignmentsChanged =
      currentMode === "game"
      && lastVariantAssignmentsSignatureRef.current !== currentVariantAssignmentsSignature;

    // If nothing affecting the data source changed and we already fetched, skip
    if (hasFetchedRef.current && !gameChanged && !modeChanged && !roomChanged && !roomStateChanged && !variantAssignmentsChanged) {
      return;
    }

    hasFetchedRef.current = true;
    lastGameIdRef.current = currentGameId;
    lastModeRef.current = currentMode;
    lastRoomIdRef.current = collaboration?.roomId || null;
    lastRoomStateSignatureRef.current = roomStateSignature;
    lastVariantAssignmentsSignatureRef.current = currentVariantAssignmentsSignature;

    const isCreator = currentMode === "creator";

    const applyLevels = async (levelsSnapshot: Level[], mapName: string) => {
      let solutions: SolutionsByLevelName = {};
      try {
        let fetchedLevels: Level[] = levelsSnapshot;
        let nextLevels: Level[] = fetchedLevels;

        if (!isCreator) {
          const gameProgressData =
            currentGame?.progressData && typeof currentGame.progressData === "object"
              ? currentGame.progressData
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
          nextLevels = nextLevels.map((level) => {
            level.solution = {
              html: solutions[level.name]?.html || "",
              css: solutions[level.name]?.css || "",
              js: solutions[level.name]?.js || "",
            };
            return level as Level;
          });
        }

        // Only non-collaborative paths fall back to a local starter level.
        if (nextLevels.length === 0 && !shouldUseWsCodeSource) {
          console.log("No levels found, creating empty starter level");
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
            timeData: { startTime: 0, pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" } },
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
          console.log("Empty level created:", emptyLevel);
        }

        // Dispatch all updates synchronously
        console.log("Dispatching levels to Redux, count:", nextLevels.length);
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

        // Restore saved best points per level from game instance (after points slice is initialized)
        const game = useGameStore.getState().getCurrentGame();
        const pointsByLevel = game?.progressData && typeof game.progressData === "object" && "pointsByLevel" in game.progressData
          ? (game.progressData as { pointsByLevel?: Record<string, { points?: number; maxPoints?: number; accuracy?: number; bestTime?: string; scenarios?: { scenarioId: string; accuracy: number }[] }> }).pointsByLevel
          : undefined;
        if (pointsByLevel && Object.keys(pointsByLevel).length > 0) {
          dispatch(mergeSavedPoints(pointsByLevel));
        }

        const savedLevel = Number(new URLSearchParams(window.location.search).get('level'));
        const nextCurrentLevel = Number.isFinite(savedLevel) && savedLevel >= 1
          ? Math.min(Math.max(1, savedLevel), Math.max(1, nextLevels.length))
          : 1;

        dispatch(setCurrentLevel(nextCurrentLevel));

        console.log("All dispatches complete, setting isLoading to false");
        // Set loading false immediately after dispatches (they're synchronous)
        setIsLoadingAsync(false);
      } catch (error) {
        console.error("Error applying levels:", error);
        setIsLoadingAsync(false);
      }
    };

    setIsLoadingAsync(true);
    if (shouldUseWsCodeSource) {
      const roomStateLevels = normalizeRoomStateLevels(
        (collaboration?.initialRoomState?.levels || []) as Array<Record<string, unknown>>,
        collaboration?.getYCodeSnapshot as ((editorType: "html" | "css" | "js", levelIndex: number) => string | null) | undefined,
      );
      applyLevels(roomStateLevels, currentGame!.mapName);
    } else {
      // Game-context routes must always use the loaded game's map; never "all" to avoid loading every level.
      const mapToFetch = isGameContextRoute
        ? currentGame!.mapName
        : urlParams.get("map") || "all";

      const fetchLevels = async (mapName: string) => {
        try {
          let fetchedLevels: Level[] = [];
          if (!currentGame?.id && mapName === "all") {
            fetchedLevels = await getAllLevels();
          } else {
            fetchedLevels = await getMapLevels(mapName);
          }
          await applyLevels(fetchedLevels, mapName);
        } catch (error) {
          console.error("Error fetching levels:", error);
          setIsLoadingAsync(false);
        }
      };
      fetchLevels(mapToFetch);
    }

    // Set mode (which also updates creator for backward compatibility)
    dispatch(setMode(currentMode));
  }, [
    dispatch,
    currentGame,
    currentGame?.id,
    currentGame?.mapName,
    currentGame?.userId,
    mode,
    routeGameId,
    normalizedPathname,
    router,
    session?.userId,
    session?.user?.email,
    collaboration?.roomId,
    collaboration?.codeSyncReady,
    collaboration?.initialRoomState,
    collaboration?.getYCodeSnapshot,
  ]);

  const isWaitingForSharedCode =
    options.mode === "game" &&
    Boolean(collaboration?.roomId) &&
    (
      !collaboration.isSessionEvicted &&
      !collaboration.codeSyncReady ||
      !collaboration.initialRoomState
    );

  const expandEditorPanel = () => {
    editorPanelRef.current?.expand();
  };

  const collapseEditorPanel = () => {
    editorPanelRef.current?.collapse();
  };

  const toggleEditorPanel = () => {
    if (isEditorCollapsed) {
      expandEditorPanel();
    } else {
      collapseEditorPanel();
    }
  };

  // Request enough height from parent LTI iframe to prevent scrollbars
  useEffect(() => {
    console.log("isLoading", isLoading);
    if (isLoading) return;

    const targetHeight = 900;
    try {
      window.parent.postMessage({ subject: "lti.frameResize", height: targetHeight }, "*");
      window.parent.postMessage({ type: "a-plus-resize-iframe", height: targetHeight }, "*");
    } catch (e) {
      console.warn("Could not post frameResize message to parent", e);
    }
  }, [isLoading]);

  return (
    <>
      <ProgressionSync />
      <ProgressPersistence />
      <LevelMetaSync />
      <GameplayTelemetryTracker />
      <article id="App" className="flex h-full min-h-0 flex-col justify-start">
        <LevelUpdater />
        <div className="flex-1 min-h-0">
          <GameContainer>
            {isLoading || isWaitingForSharedCode ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground">
                    {isWaitingForSharedCode ? "Syncing shared code..." : "Loading levels..."}
                  </p>
                </div>
              </div>
            ) : levels.length > 0 ? (
              <ScenarioProvider>
              <DrawboardNavbarCaptureProvider>
                <GameboardTourController />
                <Navbar />
                <div
                  ref={contentRowRef}
                  className="relative flex w-full flex-1 items-stretch overflow-hidden"
                >
                  {showEditorWorkbenchSidebar ? (
                    <div
                      id="creator-workbench-sidebar-root"
                      className="flex h-full max-h-full min-h-0 flex-none shrink-0 flex-col overflow-hidden"
                    />
                  ) : null}
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    <ResizablePanelGroup
                      id={STABLE_LAYOUT_GROUP_ID}
                      groupRef={panelGroupRef}
                      orientation={groupOrientation}
                      defaultLayout={activeLayout.defaultLayout}
                      onLayoutChanged={activeLayout.onLayoutChanged}
                      className="h-full w-full"
                    >
                    <ResizablePanel
                      id="artboards"
                      defaultSize={shouldStackGameLayout ? 56 : 60}
                      minSize={shouldStackGameLayout ? 28 : 38}
                      className="min-h-0 min-w-0"
                    >
                      <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden">
                        <ArtBoards />
                      </div>
                    </ResizablePanel>
                    <ResizableHandle
                      withHandle
                      groupOrientation={groupOrientation}
                      isPanelCollapsed={isEditorCollapsed}
                      onTogglePanel={toggleEditorPanel}
                    />
                    <ResizablePanel
                      id="editor"
                      panelRef={editorPanelRef}
                      collapsible
                      collapsedSize={0}
                      minSize={shouldStackGameLayout ? 20 : 24}
                      defaultSize={shouldStackGameLayout ? 44 : 40}
                      onResize={(panelSize) => setIsEditorCollapsed(panelSize.asPercentage === 0)}
                      className="min-h-0 min-w-0"
                    >
                      <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden">
                        <Editors />
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                  </div>
                </div>
                <Footer />
                <CreatorAiChatDrawer />
              </DrawboardNavbarCaptureProvider>
              </ScenarioProvider>
            ) : null}
          </GameContainer>
        </div>
      </article>
    </>
  );
}

export default App;
