'use client';

import NewEditors from "./Editors/EditorsNew";
import { ArtBoards } from "./ArtBoards/ArtBoards";
import { LevelUpdater } from "./General/LevelUpdater";
import { GameContainer } from "./General/GameContainer";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import InfoInstructions from "./InfoBoard/InfoInstructions";
import { useEffect } from "react";
import { updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { sendScoreToParentFrame } from "@/store/actions/score.actions";
import { Footer } from "./Footer/Footer";
import { Navbar } from "./Navbar/Navbar";
import { setCreator } from "@/store/slices/options.slice";
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
import { initializePoints } from "@/store/slices/points.slice";
import { ThemeSync } from "./General/ThemeSync";
import { ProgressionSync } from "./General/ProgressionSync";


export let allLevels: Level[] = [];

function App() {
  const levels = useAppSelector((state) => state.levels);
  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const isCreator = options.creator;

  useEffect(() => {
    // once it's mounted, check URL params to determine the map and creator mode
    // Example url: http://localhost:3000/creator?map=test
    const isCreator = typeof window !== 'undefined' && window.location.pathname.includes("creator");

    const urlParams = typeof window !== 'undefined' 
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
    const map = urlParams.get("map") || "all";
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
      dispatch(initializePoints(allLevels));
      dispatch(setSolutions(solutions));
      setAllLevels(allLevels);
    } else {
      const fetchLevels = async (mapName: string) => {
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
        dispatch(updateWeek({ levels: allLevels, mapName }));
        dispatch(initializePoints(allLevels));
        dispatch(setSolutions(solutions));
        setAllLevels(allLevels);
      };
      fetchLevels(map || "all");
    }

    // also check whether or not we are in the creator
    dispatch(setCreator(isCreator));

    dispatch(sendScoreToParentFrame());
  }, [dispatch]);

  return (
    <SnackbarProvider>
      <ThemeSync />
      <ProgressionSync />
      <article id="App" className="h-full flex flex-col justify-between">
        <LevelUpdater />
        <div className="flex-1">
        <Notifications />

        <GameContainer>
          {levels.length > 0 && (
            <>
                  <Navbar />
              <div
                className="flex flex-row flex-wrap justify-center w-full flex-1 overflow-hidden"
              >
                <div className="flex-1">
         
                  <ArtBoards />
    
                </div>
                <NewEditors />
              </div>
              <Footer />
            </>
          )}
        </GameContainer>
        </div>
      </article>
    </SnackbarProvider>
  );
}

export default App;

