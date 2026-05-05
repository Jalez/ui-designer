"use client";

import { GameToolsSidebar } from "@/components/Navbar/GameToolsSidebar";
import type { NavbarRegistrySection } from "../../types";

export function registerGameWorkbenchSection(visible: boolean): NavbarRegistrySection {
  return {
    id: "game",
    order: 40,
    build: (context) => ({
      id: "game",
      visible,
      title: "Game",
      children: (
        <GameToolsSidebar
          mapEditorRef={context.mapEditorRef}
          isGameRoute={context.isGameRoute}
          isCreatorRoute={context.isCreatorRoute}
          currentGameId={context.currentGameId}
          canEditCurrentGame={context.canEditCurrentGame}
          showCreatorGameMenus={context.showCreatorGameMenus}
          isGroupGame={context.isGroupGame}
          openGameLobby={context.onOpenGameLobby}
          togglePopper={context.onToggleResetDialog}
          shouldEmphasizeFinishGame={context.shouldEmphasizeFinishGame}
          onSwitchToCreator={context.currentGameId ? context.onSwitchToCreator : undefined}
        />
      ),
    }),
  };
}
