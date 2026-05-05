"use client";

import { useEffect, useState } from "react";

export type CreatorWorkbenchSubnavTabId = "creator" | "variants" | "events" | "game";

const CREATOR_WORKBENCH_PANELS_STORAGE_KEY = "creator-workbench-panels";

const DEFAULT_CREATOR_WORKBENCH_PANELS: Record<CreatorWorkbenchSubnavTabId, boolean> = {
  creator: true,
  variants: false,
  events: true,
  game: true,
};

function loadStoredCreatorWorkbenchPanels(): Record<CreatorWorkbenchSubnavTabId, boolean> {
  if (typeof window === "undefined") {
    return DEFAULT_CREATOR_WORKBENCH_PANELS;
  }

  try {
    const raw = window.localStorage.getItem(CREATOR_WORKBENCH_PANELS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_CREATOR_WORKBENCH_PANELS;
    }

    const parsed = JSON.parse(raw) as Partial<Record<CreatorWorkbenchSubnavTabId, unknown>>;
    return {
      creator: typeof parsed.creator === "boolean" ? parsed.creator : DEFAULT_CREATOR_WORKBENCH_PANELS.creator,
      variants: typeof parsed.variants === "boolean" ? parsed.variants : DEFAULT_CREATOR_WORKBENCH_PANELS.variants,
      events: typeof parsed.events === "boolean" ? parsed.events : DEFAULT_CREATOR_WORKBENCH_PANELS.events,
      game: typeof parsed.game === "boolean" ? parsed.game : DEFAULT_CREATOR_WORKBENCH_PANELS.game,
    };
  } catch {
    return DEFAULT_CREATOR_WORKBENCH_PANELS;
  }
}

export function useCreatorWorkbenchPanels() {
  const [creatorWorkbenchPanels, setCreatorWorkbenchPanels] = useState<
    Record<CreatorWorkbenchSubnavTabId, boolean>
  >(() => loadStoredCreatorWorkbenchPanels());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      CREATOR_WORKBENCH_PANELS_STORAGE_KEY,
      JSON.stringify(creatorWorkbenchPanels),
    );
  }, [creatorWorkbenchPanels]);

  return {
    creatorWorkbenchPanels,
    setCreatorWorkbenchPanels,
  };
}
