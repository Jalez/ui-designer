"use client";

import { GameRouteMenu } from "@/components/Navbar/GameRouteMenu";
import type { NavbarRegistryItem } from "../../types";

export const registerGameRouteMenu = (): NavbarRegistryItem => ({
  id: "creator-game-route-menu",
  order: 10,
  placement: "compact-creator",
  render: (context, slot = "desktop") => (
    <div className="flex flex-none" {...context.tourSpotProps("navbar.creator_game_menu", slot)}>
      <div className="rounded-md px-2 py-1.5">
        <GameRouteMenu
          canEditCurrentGame={context.canEditCurrentGame}
          currentGameId={context.currentGameId}
          isCreatorRoute={context.isCreatorRoute}
          isGameRoute={context.isGameRoute}
          isGroupGame={context.isGroupGame}
          onOpenCreatorPreview={context.onOpenCreatorPreview}
          onOpenGameLobby={context.onOpenGameLobby}
          onOpenMapEditor={() => context.mapEditorRef.current?.triggerOpen()}
          onToggleResetDialog={context.onToggleResetDialog}
          shouldEmphasizeFinishGame={context.shouldEmphasizeFinishGame}
          showCreatorGameMenus={context.showCreatorGameMenus}
        />
      </div>
    </div>
  ),
});
