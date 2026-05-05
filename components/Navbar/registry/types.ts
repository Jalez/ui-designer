"use client";

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { MapEditorRef } from "@/components/CreatorControls/MapEditor";
import type { CreatorWorkbenchSection } from "../CreatorWorkbenchSubSidebar";
import type { CreatorWorkbenchSubnavTabId } from "../useCreatorWorkbenchPanels";

export type NavbarResponsiveSlot = "mobile" | "desktop";

export type NavbarPlacement =
  | "compact-player"
  | "inline-player"
  | "compact-creator"
  | "compact-workbench"
  | "mode-toggle"
  | "default-status";

export type NavbarRegistryContext = {
  canEditCurrentGame: boolean;
  creatorWorkbenchPanels: Record<CreatorWorkbenchSubnavTabId, boolean>;
  currentGameId?: string;
  dismissCompactGameShake: () => void;
  hasDismissedCompactGameShake: boolean;
  isCreatorRoute: boolean;
  isCreatorWorkbenchContext: boolean;
  isGameRoute: boolean;
  isGroupGame: boolean;
  isMobile: boolean;
  levelChanger: (pickedLevel: number) => void;
  mapEditorRef: RefObject<MapEditorRef | null>;
  onOpenCreatorPreview: () => void;
  onOpenGameLobby: () => void;
  onOpenOverlay: () => void;
  onSetCreatorWorkbenchPanels: Dispatch<SetStateAction<Record<CreatorWorkbenchSubnavTabId, boolean>>>;
  onSwitchToCreator: () => void;
  onToggleResetDialog: (scope: "level" | "game") => void;
  points: {
    allMaxPoints: number;
    allPoints: number;
  };
  shouldEmphasizeFinishGame: boolean;
  shouldShowCreatorSidebarToggle: boolean;
  shouldShowMobileSidebarToggle: boolean;
  showCreatorGameMenus: boolean;
  tourSpotProps: (spot: string, slot: NavbarResponsiveSlot) => Record<string, string>;
};

export type NavbarRegistryItem = {
  id: string;
  order: number;
  placement: NavbarPlacement;
  render: (context: NavbarRegistryContext, slot?: NavbarResponsiveSlot) => ReactNode;
};

export type NavbarRegistrySection = {
  id: string;
  order: number;
  build: (context: NavbarRegistryContext) => CreatorWorkbenchSection;
};
