'use client';

import Editors from "./Editors/Editors";
import { ArtBoards } from "./ArtBoards/ArtBoards";
import { LevelUpdater } from "./General/LevelUpdater";
import { GameContainer } from "./General/GameContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import InfoInstructions from "./InfoBoard/InfoInstructions";
import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { updateWeek, setAllLevels, resetAllLevelCodes, snapshotCreatorCodes } from "@/store/slices/levels.slice";
import { sendScoreToParentFrame } from "@/store/actions/score.actions";
import { Footer } from "./Footer/Footer";
import { Navbar } from "./Navbar/Navbar";
import { setCreator, setMode } from "@/store/slices/options.slice";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { Level } from "@/types";
import Info from "./InfoBoard/Info";
import {
  SolutionMap,
  availableWeeks,
  createLevels,
  week,
} from "@/lib/utils/LevelCreator";
import Notifications from "./General/Notifications";
import { SnackbarProvider } from "notistack";
import { setSolutions } from "@/store/slices/solutions.slice";
import { resetSolutionUrls } from "@/store/slices/solutionUrls.slice";
import { getAllLevels } from "@/lib/utils/network/levels";
import { getMapLevels } from "@/lib/utils/network/maps";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { ProgressionSync } from "./General/ProgressionSync";
import { GameCodeSync } from "./General/GameCodeSync";
import { useGameStore } from "./default/games";
import { useSession } from "next-auth/react";
import type { Mode } from "@/store/slices/options.slice";


export let allLevels: Level[] = [];

function mergeSavedCode(levels: Level[], progressData: Record<string, unknown> | undefined | null): Level[] {
  if (!progressData || !Array.isArray(progressData.levels)) return levels;
  const savedLevels = progressData.levels as Array<{ name: string; code: { html: string; css: string; js: string } }>;
  const savedByName = new Map(savedLevels.map((l) => [l.name, l.code]));
  return levels.map((level) => {
    const savedCode = savedByName.get(level.name);
    if (savedCode) {
      return { ...level, code: { ...level.code, ...savedCode } };
    }
    return level;
  });
}

function App() {
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const [isLoading, setIsLoading] = useState(true);
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const mode = searchParams.get('mode');
  const hasFetchedRef = useRef(false);
  const lastGameIdRef = useRef<string | null>(null);
  const lastModeRef = useRef<string | null>(null);

  useEffect(() => {
    // Get current URL params
    const urlParams = typeof window !== 'undefined' 
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const isPlayRoute = pathname.startsWith('/play/');
    const isGameRoute = pathname.startsWith('/game/');
    const isGroupRoute = pathname.startsWith('/group/');
    const isGameContextRoute = isPlayRoute || isGameRoute || isGroupRoute;
    const defaultMode: Mode = isPlayRoute ? 'game' : 'test';
    const requestedMode = (urlParams.get("mode") || defaultMode) as Mode;

    const sessionUserId = session?.userId || session?.user?.email || "";
    const gameOwnerId = currentGame?.userId || "";
    const fallbackOwnerCheck = !!gameOwnerId && sessionUserId === gameOwnerId;
    const canEditCurrentGame = currentGame?.canEdit ?? fallbackOwnerCheck;

    const currentMode: Mode = isGameContextRoute && !canEditCurrentGame ? 'game' : requestedMode;

    if (isGameContextRoute && requestedMode !== currentMode) {
      const normalizedParams = new URLSearchParams(urlParams.toString());
      normalizedParams.set("mode", currentMode);
      router.replace(`${pathname}?${normalizedParams.toString()}`);
    }

    const currentGameId = currentGame?.id || null;
    
    // Check if game or mode changed
    const gameChanged = lastGameIdRef.current !== currentGameId;
    const modeChanged = lastModeRef.current !== currentMode;
    
    // If neither changed and we already fetched, skip
    if (hasFetchedRef.current && !gameChanged && !modeChanged) {
      return;
    }
    
    // If only mode changed, update mode state without refetching levels
    if (hasFetchedRef.current && !gameChanged && modeChanged) {
      console.log("Mode changed to:", currentMode);
      const previousMode = lastModeRef.current;
      dispatch(setMode(currentMode));
      lastModeRef.current = currentMode;
      if (currentMode === "test" && previousMode === "creator") {
        // Snapshot creator's template before test mode overwrites level.code
        dispatch(snapshotCreatorCodes());
      } else if (currentMode === "creator") {
        // Restore creator's template, discarding test-mode edits
        dispatch(resetAllLevelCodes());
      }
      return;
    }
    
    hasFetchedRef.current = true;
    lastGameIdRef.current = currentGameId;
    lastModeRef.current = currentMode;
    
    // Creator mode is now controlled by ?mode=creator URL param
    const isCreator = currentMode === "creator";
    
    // Use game's mapName if available, otherwise use URL param or default
    const map = currentGame?.mapName || urlParams.get("map") || "all";
    const mapName = map as week;
    let solutions: SolutionMap = {};

    if (availableWeeks.includes(map)) {
      console.log();
      const levelsObj = createLevels(map as week);
      const levels = levelsObj?.levels || [];
      allLevels = levels;
      solutions = levelsObj?.solutions || {};
      if (isCreator) {
        allLevels = allLevels.map((level) => {
          level.solution = {
            html: solutions[level.name]?.html || "",
            css: solutions[level.name]?.css || "",
            js: solutions[level.name]?.js || "",
          };
          return level as Level;
        });
      }
      // Merge saved code from progressData for group games
      if (currentGame?.progressData) {
        allLevels = mergeSavedCode(allLevels, currentGame.progressData as Record<string, unknown>);
      }
      dispatch(updateWeek({ levels: allLevels, mapName, gameId: currentGame?.id }));
      dispatch(initializePointsFromLevelsStateThunk());
      dispatch(setSolutions(solutions));
      dispatch(resetSolutionUrls());
      setAllLevels(allLevels);
      queueMicrotask(() => setIsLoading(false));
    } else {
      const fetchLevels = async (mapName: string) => {
        try {
          if (mapName === "all") {
            allLevels = await getAllLevels();
          } else {
            allLevels = await getMapLevels(mapName);
          }
          solutions = allLevels.reduce((acc, level) => {
            acc[level.name] = {
              html: level.solution.html,
              css: level.solution.css,
              js: level.solution.js,
            };
            return acc;
          }, {} as SolutionMap);

          if (isCreator) {
            allLevels = allLevels.map((level) => {
              level.solution = {
                html: solutions[level.name]?.html || "",
                css: solutions[level.name]?.css || "",
                js: solutions[level.name]?.js || "",
              };
              return level as Level;
            });
          }
          console.log("solutions", solutions);
          
          // If no levels exist, create an empty default level
          if (allLevels.length === 0) {
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
              difficulty: "easy",
              instructions: [],
              question_and_answer: { question: "", answer: "" },
              help: { description: "Start coding!", images: [], usefullCSSProperties: [] },
              timeData: { startTime: 0, pointAndTime: { 0: "0:0", 1: "0:0", 2: "0:0", 3: "0:0", 4: "0:0", 5: "0:0" } },
              events: [],
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
            allLevels = [emptyLevel];
            solutions[emptyLevel.name] = { html: "", css: "", js: "" };
            console.log("Empty level created:", emptyLevel);
          }
          
          // Merge saved code from progressData for group games
          if (currentGame?.progressData) {
            allLevels = mergeSavedCode(allLevels, currentGame.progressData as Record<string, unknown>);
          }

          // Dispatch all updates synchronously
          console.log("Dispatching levels to Redux, count:", allLevels.length);
          dispatch(updateWeek({ levels: allLevels, mapName, gameId: currentGame?.id }));
          dispatch(setSolutions(solutions));
          dispatch(resetSolutionUrls());
          setAllLevels(allLevels);
          dispatch(initializePointsFromLevelsStateThunk());
          
          // Reset to level 1 when loading new levels
          dispatch(setCurrentLevel(1));
          
          console.log("All dispatches complete, setting isLoading to false");
          // Set loading false immediately after dispatches (they're synchronous)
          setIsLoading(false);
        } catch (error) {
          console.error("Error fetching levels:", error);
          setIsLoading(false);
        }
      };
      fetchLevels(map || "all");
    }

    // Set mode (which also updates creator for backward compatibility)
    dispatch(setMode(currentMode));
    dispatch(sendScoreToParentFrame());
  }, [dispatch, currentGame?.id, currentGame?.mapName, currentGame?.userId, mode, pathname, router, session?.userId, session?.user?.email]);

  return (
    <SnackbarProvider>
      <ProgressionSync />
      <GameCodeSync />
      <article id="App" className="h-full flex flex-col justify-between">
        <LevelUpdater />
        <div className="flex-1">
        <Notifications />

        <GameContainer>
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground">Loading levels...</p>
              </div>
            </div>
          ) : levels.length > 0 ? (
            <>
              <Navbar />
              <div
                className="flex flex-row flex-wrap justify-center items-stretch w-full flex-1 overflow-hidden"
              >
                <div className="flex-1 flex items-center justify-center">
                  <ArtBoards />
                </div>
                <Editors />
              </div>
              <Footer />
            </>
          ) : null}
        </GameContainer>
        </div>
      </article>
    </SnackbarProvider>
  );
}

export default App;
