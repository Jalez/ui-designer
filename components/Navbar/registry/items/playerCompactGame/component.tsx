"use client";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AplusSubmitButton } from "@/components/Navbar/AplusSubmitButton";
import Shaker from "@/components/General/Shaker/Shaker";
import { compactMenuButtonClass, compactMenuLabelClass } from "@/components/General/CompactMenuButton";
import { cn } from "@/lib/utils/cn";
import { Flag, Gamepad2, Users } from "lucide-react";
import type { NavbarRegistryContext } from "../../types";

type PlayerCompactGameProps = {
  context: NavbarRegistryContext;
};

export function PlayerCompactGame({ context }: PlayerCompactGameProps) {
  const {
    dismissCompactGameShake,
    hasDismissedCompactGameShake,
    isGroupGame,
    onOpenGameLobby,
    points,
    shouldEmphasizeFinishGame,
  } = context;

  return (
    <div
      className="flex flex-none"
      {...(context.isMobile ? { "data-tour-spot": "navbar.game_route_mobile_game_menu" as const } : {})}
    >
      <div className="rounded-md px-2 py-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={compactMenuButtonClass}
              onClick={dismissCompactGameShake}
            >
              <Shaker
                value={points.allPoints >= points.allMaxPoints && points.allMaxPoints > 0 ? 1 : 0}
                className={cn(
                  "inline-flex items-center justify-center gap-1 max-[519px]:flex-col",
                  shouldEmphasizeFinishGame && !hasDismissedCompactGameShake && "animate-shake-burst",
                )}
              >
                <span className={`${compactMenuLabelClass} min-[520px]:hidden`}>
                  Game
                </span>
                <Gamepad2 className="h-4 w-4" />
                <span className="hidden min-[520px]:inline text-xs font-medium">Game</span>
              </Shaker>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-72 space-y-3">
            <p className="text-xs leading-snug text-muted-foreground">
              Score, group lobby, and finish, grouped for small screens.
            </p>
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Gamepad2 className="h-3.5 w-3.5" />
                <span>Game</span>
              </div>
              <div className="mt-3 rounded-md bg-background/80 px-3 py-2 text-center">
                <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Total Score
                </div>
                <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                  Your cumulative points across all levels, out of the maximum you can earn.
                </p>
                <div className="mt-1 text-sm font-semibold text-foreground">
                  {points.allPoints || 0}/{points.allMaxPoints || 0}
                </div>
              </div>
              {isGroupGame ? (
                <div className="mt-3 space-y-1.5 rounded-md bg-background/80 px-3 py-2">
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    Return to the lobby to join a different group or wait for your team.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center gap-2"
                    onClick={onOpenGameLobby}
                  >
                    <Users className="h-4 w-4" />
                    <span>To lobby</span>
                  </Button>
                </div>
              ) : null}
              <div className="mt-3 space-y-1.5 rounded-md bg-background/80 px-3 py-2">
                <p className="text-[10px] leading-snug text-muted-foreground">
                  Open the finish screen to review your run, save your score, and submit if your course requires it.
                </p>
                <AplusSubmitButton
                  displayMode="icon-label"
                  shouldShake={shouldEmphasizeFinishGame}
                  renderTrigger={({ openDialog }) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-center gap-2"
                      onClick={openDialog}
                    >
                      <Flag className="h-4 w-4" />
                      <span>Finish game</span>
                    </Button>
                  )}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
