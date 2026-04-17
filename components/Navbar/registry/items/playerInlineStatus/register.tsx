"use client";

import { Button } from "@/components/ui/button";
import InfoGamePoints from "@/components/InfoBoard/InfoGamePoints";
import { AplusSubmitButton } from "@/components/Navbar/AplusSubmitButton";
import { Users } from "lucide-react";
import type { NavbarRegistryItem } from "../../types";

export const registerPlayerInlineScore = (): NavbarRegistryItem => ({
  id: "player-inline-score",
  order: 10,
  placement: "inline-player",
  render: (context) => (
    <div
      className="flex flex-none"
      {...(!context.isMobile ? { "data-tour-spot": "navbar.game_route_score" as const } : {})}
    >
      <InfoGamePoints />
    </div>
  ),
});

export const registerPlayerInlineLobby = (): NavbarRegistryItem => ({
  id: "player-inline-lobby",
  order: 20,
  placement: "inline-player",
  render: (context) => (
    context.isGroupGame ? (
      <div
        className="flex flex-none"
        {...(!context.isMobile ? { "data-tour-spot": "navbar.game_route_lobby" as const } : {})}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-center gap-2"
          onClick={context.onOpenGameLobby}
          title="Return to the lobby to join a different group or wait for teammates."
        >
          <Users className="h-4 w-4" />
          <span>To lobby</span>
        </Button>
      </div>
    ) : null
  ),
});

export const registerPlayerInlineFinish = (): NavbarRegistryItem => ({
  id: "player-inline-finish",
  order: 30,
  placement: "inline-player",
  render: (context) => (
    <div
      className="flex flex-none"
      {...(!context.isMobile ? { "data-tour-spot": "navbar.game_route_finish" as const } : {})}
    >
      <AplusSubmitButton displayMode="icon-label" shouldShake={context.shouldEmphasizeFinishGame} />
    </div>
  ),
});
