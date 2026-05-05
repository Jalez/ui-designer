'use client';

import { useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks/hooks";
import { levelUrl } from "@/constants";
import { updateLevelIdentifier } from "@/store/slices/levels.slice";
import { setAutoSaveLevels, setIsSavingLevel, setLastSaved } from "@/store/slices/options.slice";
import { addLevelsToMap } from "@/lib/utils/network/maps";
import { useGameStore } from "@/components/default/games";
import { serializeLevelForPersistence } from "@/lib/levels/variants";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUTO_SAVE_DELAY_MS = 1500;

const isValidUUID = (str: string): boolean => UUID_REGEX.test(str);

// Module-level guard: prevents duplicate POST requests when multiple hook instances
// exist (e.g. two <CreatorControls> rendered for responsive layouts).
let globalCreateInFlight = false;
const globalSaveTokensInFlight = new Set<string>();
const globalLastSavedSnapshotByLevel = new Map<string, string>();

export const useLevelSaver = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const isCreator = useAppSelector((state) => state.options.mode === "creator");
  const autoSaveEnabled = useAppSelector((state) => state.options.autoSaveLevels);
  const currentGame = useGameStore((state) => state.getCurrentGame());

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const pendingSaveCountRef = useRef(0);
  const autoSaveScheduledRef = useRef(false);
  const createInFlightRef = useRef(false);

  const getLevelAutosaveKey = (levelToSave: typeof level): string => {
    const stableIdentifier =
      levelToSave?.identifier && isValidUUID(levelToSave.identifier)
        ? levelToSave.identifier
        : `${currentGame?.id || currentGame?.mapName || "local"}:${currentLevel}:${levelToSave?.name || "unnamed"}`;
    return stableIdentifier;
  };

  const serializeLevel = (levelToSerialize: typeof level): string =>
    JSON.stringify(levelToSerialize ? serializeLevelForPersistence(levelToSerialize) : null);

  const saveLevel = async (levelToSave: typeof level): Promise<void> => {
    if (!levelToSave) {
      throw new Error("No level selected");
    }

    if (levelToSave.identifier && !isValidUUID(levelToSave.identifier)) {
      throw new Error(
        `Invalid identifier format: "${levelToSave.identifier}" is not a valid UUID. ` +
          `Remove the identifier to create a new level, or use a valid UUID to update an existing level.`
      );
    }

    const isUpdate = !!levelToSave.identifier && isValidUUID(levelToSave.identifier);
    if (!isUpdate && (createInFlightRef.current || globalCreateInFlight)) {
      // Avoid duplicate creates for a brand-new unsaved level while create request is in flight.
      return;
    }
    const levelAutosaveKey = getLevelAutosaveKey(levelToSave);
    const levelSnapshot = serializeLevel(levelToSave);
    const saveToken = `${levelAutosaveKey}:${levelSnapshot}`;
    if (globalSaveTokensInFlight.has(saveToken)) {
      return;
    }
    if (globalLastSavedSnapshotByLevel.get(levelAutosaveKey) === levelSnapshot) {
      return;
    }
    const url = isUpdate ? `${levelUrl}/${levelToSave.identifier}` : levelUrl;
    const method = isUpdate ? "PUT" : "POST";

    const serializedLevel = serializeLevelForPersistence(levelToSave);
    const { name, ...json } = serializedLevel;
    const body = { name, ...json };

    pendingSaveCountRef.current += 1;
    if (pendingSaveCountRef.current === 1) {
      dispatch(setIsSavingLevel(true));
    }
    if (!isUpdate) {
      createInFlightRef.current = true;
      globalCreateInFlight = true;
    }
    globalSaveTokensInFlight.add(saveToken);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          if (errorText) errorMessage += `: ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (!isUpdate && data.identifier) {
          if (currentGame?.mapName) {
            await addLevelsToMap(currentGame.mapName, [data.identifier]);
          }
          dispatch(updateLevelIdentifier({ levelId: currentLevel, identifier: data.identifier }));
        }
      }

      lastSavedSnapshotRef.current = levelSnapshot;
      globalLastSavedSnapshotByLevel.set(levelAutosaveKey, levelSnapshot);
      dispatch(setLastSaved(Date.now()));
    } finally {
      globalSaveTokensInFlight.delete(saveToken);
      if (!isUpdate) {
        createInFlightRef.current = false;
        globalCreateInFlight = false;
      }
      pendingSaveCountRef.current = Math.max(0, pendingSaveCountRef.current - 1);
      if (pendingSaveCountRef.current === 0) {
        dispatch(setIsSavingLevel(false));
      }
    }
  };

  const handleSave = async () => {
    if (!level) {
      alert("No level selected");
      return;
    }
    try {
      await saveLevel(level);
      alert(`Level ${level.identifier && isValidUUID(level.identifier) ? "updated" : "created"} successfully!`);
    } catch (error) {
      console.error("Error saving level:", error);
      alert(`Failed to save level: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const toggleAutoSave = () => {
    dispatch(setAutoSaveLevels(!autoSaveEnabled));
  };

  useEffect(() => {
    if (!isCreator || !autoSaveEnabled || !level) return;

    const currentSnapshot = serializeLevel(level);
    const currentLevelAutosaveKey = getLevelAutosaveKey(level);
    if (!isMounted.current) {
      isMounted.current = true;
      lastSavedSnapshotRef.current = currentSnapshot;
      globalLastSavedSnapshotByLevel.set(currentLevelAutosaveKey, currentSnapshot);
      return;
    }
    if (
      lastSavedSnapshotRef.current === currentSnapshot ||
      globalLastSavedSnapshotByLevel.get(currentLevelAutosaveKey) === currentSnapshot
    ) {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      if (autoSaveScheduledRef.current && pendingSaveCountRef.current === 0) {
        autoSaveScheduledRef.current = false;
        dispatch(setIsSavingLevel(false));
      }
      return;
    }

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (!autoSaveScheduledRef.current && pendingSaveCountRef.current === 0) {
      autoSaveScheduledRef.current = true;
      dispatch(setIsSavingLevel(true));
    }
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await saveLevel(level);
        console.log("[auto-save] level saved");
      } catch (error) {
        console.warn("[auto-save] failed:", error);
      } finally {
        autoSaveScheduledRef.current = false;
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
    };
  }, [level, isCreator, autoSaveEnabled, dispatch]);

  useEffect(() => {
    if (isCreator && autoSaveEnabled) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    autoSaveScheduledRef.current = false;
    if (pendingSaveCountRef.current === 0) {
      dispatch(setIsSavingLevel(false));
    }
  }, [isCreator, autoSaveEnabled, dispatch]);

  return {
    handleSave,
    autoSaveEnabled,
    toggleAutoSave,
  };
};
