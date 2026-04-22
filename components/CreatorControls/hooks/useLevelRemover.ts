'use client';

import { useCallback } from "react";
import { useGameStore } from "@/components/default/games";
import { getMapLevels, removeLevelFromMap as removeLevelFromMapRequest } from "@/lib/utils/network/maps";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { removeLevel, updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { resetDrawingUrls } from "@/store/slices/drawingUrls.slice";
import { toast } from "sonner";
import { useLevelMetaSync } from "@/lib/collaboration/hooks/useLevelMetaSync";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const useLevelRemover = () => {
  const currentLevel = useAppSelector(
    (state) => state.currentLevel.currentLevel
  );
  const levels = useAppSelector((state) => state.levels);
  const options = useAppSelector((state) => state.options);
  const dispatch = useAppDispatch();
  const currentGame = useGameStore((state) => state.getCurrentGame());
  const currentGameId = currentGame?.id ?? null;
  const currentGameMapName = currentGame?.mapName ?? null;
  const { syncLevelOp } = useLevelMetaSync();

  const refreshCurrentMapLevels = useCallback(async () => {
    if (!currentGameId || !currentGameMapName) return;

    const freshLevels = await getMapLevels(currentGameMapName, { forceFresh: true });

    dispatch(
      updateWeek({
        levels: freshLevels,
        mapName: currentGameMapName,
        gameId: currentGameId,
        mode: options.mode,
        forceFresh: true,
      }),
    );
    dispatch(resetDrawingUrls());
    setAllLevels(freshLevels);
    dispatch(initializePointsFromLevelsStateThunk());

    if (currentLevel > freshLevels.length) {
      dispatch(setCurrentLevel(Math.max(1, freshLevels.length)));
    }
  }, [currentGameId, currentGameMapName, currentLevel, dispatch, options.mode]);

  const handleRemove = useCallback(async () => {
    if (levels.length === 1) {
      toast.warning("Cannot remove the last level");
      return;
    }

    const levelToRemove = levels[currentLevel - 1];
    if (!levelToRemove) {
      return;
    }

    if (!levelToRemove.identifier || !UUID_REGEX.test(levelToRemove.identifier)) {
      if (currentLevel === levels.length) {
        dispatch(setCurrentLevel(Math.max(1, currentLevel - 1)));
      }
      dispatch(removeLevel(currentLevel));
      syncLevelOp("remove-level", { levelIndex: currentLevel - 1 });
      toast.success("Unsaved level removed");
      return;
    }

    if (!currentGameMapName) {
      toast.error("Current game map is missing");
      return;
    }

    try {
      await removeLevelFromMapRequest(currentGameMapName, levelToRemove.identifier);
      await refreshCurrentMapLevels();
      toast.success("Level removed from game");
    } catch (error) {
      console.error("Failed to remove level from map", error);
      toast.error("Failed to remove level");
    }
  }, [levels, currentLevel, currentGameMapName, refreshCurrentMapLevels, dispatch, syncLevelOp]);

  return { handleRemove };
};
