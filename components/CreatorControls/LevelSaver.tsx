'use client';

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAppSelector, useAppDispatch } from "@/store/hooks/hooks";
import PoppingTitle from "../General/PoppingTitle";
import { Save } from "lucide-react";
import { levelUrl } from "@/constants";
import { updateLevelIdentifier } from "@/store/slices/levels.slice";
import { setLastSaved } from "@/store/slices/options.slice";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isValidUUID = (str: string): boolean => UUID_REGEX.test(str);
const AUTO_SAVE_DELAY_MS = 3000;

const LevelSaver = () => {
  const dispatch = useAppDispatch();
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  const isCreator = useAppSelector((state) => state.options.creator);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);

  const save = async (levelToSave: typeof level): Promise<void> => {
    if (!levelToSave) return;

    const isUpdate = !!levelToSave.identifier && isValidUUID(levelToSave.identifier);
    const url = isUpdate ? `${levelUrl}/${levelToSave.identifier}` : levelUrl;
    const method = isUpdate ? "PUT" : "POST";

    const { identifier, name, ...json } = levelToSave;
    const body = { name, ...json };

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
        dispatch(updateLevelIdentifier({ levelId: currentLevel, identifier: data.identifier }));
      }
    }

    dispatch(setLastSaved(Date.now()));
  };

  const handleSave = async () => {
    if (!level) {
      alert("No level selected");
      return;
    }
    try {
      await save(level);
      alert(`Level ${level.identifier && isValidUUID(level.identifier) ? "updated" : "created"} successfully!`);
    } catch (error) {
      console.error("Error saving level:", error);
      alert(`Failed to save level: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Auto-save in creator mode after a quiet period
  useEffect(() => {
    if (!isCreator) return;
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    if (!level) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await save(level);
        console.log("[auto-save] level saved");
      } catch (error) {
        console.warn("[auto-save] failed:", error);
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, isCreator]);

  return (
    <div className="flex flex-col justify-center items-center">
      <PoppingTitle topTitle="Save Level">
        <Button onClick={handleSave} variant="ghost" size="icon">
          <Save className="h-5 w-5" />
        </Button>
      </PoppingTitle>
    </div>
  );
};

export default LevelSaver;
