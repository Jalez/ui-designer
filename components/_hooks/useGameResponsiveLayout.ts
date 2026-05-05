"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDefaultLayout } from "react-resizable-panels";
import type { GroupImperativeHandle, PanelImperativeHandle } from "react-resizable-panels";
import type { Level } from "@/types";

const MIN_EDITOR_PANE_WIDTH = 420;
const ARTBOARD_PANE_CHROME_WIDTH = 56;
const HORIZONTAL_LAYOUT_ID = "game-layout-horizontal";
const VERTICAL_LAYOUT_ID = "game-layout-vertical";

export function useGameResponsiveLayout({
  collaboration,
  currentLevel,
  isLoading,
  levels,
}: {
  collaboration: {
    roomId?: string | null;
    codeSyncReady?: boolean;
    initialRoomState?: unknown;
    getYCodeSnapshot?: unknown;
  } | null;
  currentLevel: number;
  isLoading: boolean;
  levels: Level[];
}) {
  const contentRowRef = useRef<HTMLDivElement | null>(null);
  const editorPanelRef = useRef<PanelImperativeHandle | null>(null);
  const panelGroupRef = useRef<GroupImperativeHandle | null>(null);
  const [contentRowWidth, setContentRowWidth] = useState(0);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);

  const maxScenarioWidth = useMemo(() => {
    const activeLevel = levels[currentLevel - 1];
    const scenarios = activeLevel?.scenarios ?? [];

    if (scenarios.length === 0) {
      return 0;
    }

    return scenarios.reduce(
      (maxWidth, scenario) => Math.max(maxWidth, scenario.dimensions.width),
      0,
    );
  }, [currentLevel, levels]);

  const shouldStackGameLayout = contentRowWidth > 0
    ? contentRowWidth < maxScenarioWidth + ARTBOARD_PANE_CHROME_WIDTH + MIN_EDITOR_PANE_WIDTH
    : false;
  const groupOrientation: "vertical" | "horizontal" = shouldStackGameLayout ? "vertical" : "horizontal";
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

  return {
    activeLayout,
    contentRowRef,
    editorPanelRef,
    groupOrientation,
    isEditorCollapsed,
    panelGroupRef,
    setIsEditorCollapsed,
    shouldStackGameLayout,
    toggleEditorPanel,
  };
}
