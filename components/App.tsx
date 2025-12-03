'use client';

import Editors from "./Editors/Editors";
import { ArtBoards } from "./ArtBoards/ArtBoards";
import { LevelUpdater } from "./General/LevelUpdater";
import { GameContainer } from "./General/GameContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import InfoInstructions from "./InfoBoard/InfoInstructions";
import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { sendScoreToParentFrame } from "@/store/actions/score.actions";
import { Footer } from "./Footer/Footer";
import { Navbar } from "./Navbar/Navbar";
import { setCreator } from "@/store/slices/options.slice";
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
import { getAllLevels } from "@/lib/utils/network/levels";
import { getMapLevels } from "@/lib/utils/network/maps";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { ProgressionSync } from "./General/ProgressionSync";
import { useProjectStore } from "./default/projects";


export let allLevels: Level[] = [];

function App() {
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;
  const [isLoading, setIsLoading] = useState(true);
  const currentProject = useProjectStore((state) => state.getCurrentProject());
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const hasFetchedRef = useRef(false);
  const lastProjectIdRef = useRef<string | null>(null);
  const lastModeRef = useRef<string | null>(null);

  useEffect(() => {
    // Get current URL params
    const urlParams = typeof window !== 'undefined' 
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const currentMode = urlParams.get("mode") || "game";
    const currentProjectId = currentProject?.id || null;
    
    // Check if project or mode changed
    const projectChanged = lastProjectIdRef.current !== currentProjectId;
    const modeChanged = lastModeRef.current !== currentMode;
    
    // If neither changed and we already fetched, skip
    if (hasFetchedRef.current && !projectChanged && !modeChanged) {
      return;
    }
    
    // If only mode changed, update creator state without refetching levels
    if (hasFetchedRef.current && !projectChanged && modeChanged) {
      console.log("Mode changed to:", currentMode);
      const isCreator = currentMode === "creator";
      dispatch(setCreator(isCreator));
      lastModeRef.current = currentMode;
      return;
    }
    
    hasFetchedRef.current = true;
    lastProjectIdRef.current = currentProjectId;
    lastModeRef.current = currentMode;
    
    setIsLoading(true);
    
    // Creator mode is now controlled by ?mode=creator URL param
    const isCreator = currentMode === "creator";
    
    // Use project's mapName if available, otherwise use URL param or default
    const map = currentProject?.mapName || urlParams.get("map") || "all";
    let mapName = map as week;
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
      dispatch(updateWeek({ levels: allLevels, mapName }));
      dispatch(initializePointsFromLevelsStateThunk());
      dispatch(setSolutions(solutions));
      setAllLevels(allLevels);
      setIsLoading(false);
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
              identifier: Math.random().toString(36).substring(7),
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
              instructions: [{ title: "Getting Started", content: ["Create your first level!"] }],
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
          
          // Dispatch all updates synchronously
          console.log("Dispatching levels to Redux, count:", allLevels.length);
          dispatch(updateWeek({ levels: allLevels, mapName }));
          dispatch(setSolutions(solutions));
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

    // Set creator mode
    dispatch(setCreator(isCreator));
    dispatch(sendScoreToParentFrame());
  }, [dispatch, currentProject?.id, currentProject?.mapName, mode]);

  return (
    <SnackbarProvider>
      <ProgressionSync />
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
                className="flex flex-row flex-wrap justify-center w-full flex-1 overflow-hidden"
              >
                <div className="flex-1">
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

