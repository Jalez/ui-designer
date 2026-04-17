"use client";

import Link from "next/link";
import { BarChart3, Code2, Eye, Flag, Gamepad2, Map, RotateCcw, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CompactMenuButton } from "@/components/General/CompactMenuButton";
import { AplusSubmitButton } from "./AplusSubmitButton";

type GameRouteMenuProps = {
  canEditCurrentGame: boolean;
  currentGameId?: string;
  isCreatorRoute: boolean;
  isGameRoute: boolean;
  isGroupGame: boolean;
  onOpenCreatorPreview: () => void;
  onOpenGameLobby: () => void;
  onOpenMapEditor: () => void;
  onToggleResetDialog: (scope: "level" | "game") => void;
  shouldEmphasizeFinishGame: boolean;
  showCreatorGameMenus: boolean;
};

export function GameRouteMenu({
  canEditCurrentGame,
  currentGameId,
  isCreatorRoute,
  isGameRoute,
  isGroupGame,
  onOpenCreatorPreview,
  onOpenGameLobby,
  onOpenMapEditor,
  onToggleResetDialog,
  shouldEmphasizeFinishGame,
  showCreatorGameMenus,
}: GameRouteMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CompactMenuButton icon={Gamepad2} label="Game" text="Game" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 border-0 shadow-lg">
        <DropdownMenuLabel>Game Tools</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showCreatorGameMenus && currentGameId ? (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/creator/${currentGameId}`}>
                <Code2 className="h-4 w-4 mr-2" />
                Go to creator
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {isGameRoute && currentGameId && isGroupGame ? (
          <>
            <DropdownMenuItem onSelect={onOpenGameLobby}>
              <Users className="h-4 w-4 mr-2" />
              Back to Game Lobby
            </DropdownMenuItem>
            {showCreatorGameMenus ? (
              <DropdownMenuItem onSelect={onOpenCreatorPreview}>
                <Eye className="h-4 w-4 mr-2" />
                <div className="flex flex-col">
                  <span>Creator Preview</span>
                  <span className="text-xs text-muted-foreground">
                    Open the isolated preview without a group
                  </span>
                </div>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
          </>
        ) : null}
        {isCreatorRoute && currentGameId && canEditCurrentGame ? (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/game/${currentGameId}`}>
                <Gamepad2 className="h-4 w-4 mr-2" />
                Switch to game route
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {showCreatorGameMenus ? (
          <>
            <DropdownMenuItem onSelect={() => onToggleResetDialog("level")}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Level
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onToggleResetDialog("game")}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Game
            </DropdownMenuItem>
            <AplusSubmitButton
              displayMode="icon-label"
              shouldShake={shouldEmphasizeFinishGame}
              renderTrigger={({ openDialog }) => (
                <DropdownMenuItem onSelect={openDialog}>
                  <Flag className="h-4 w-4 mr-2" />
                  Finish Game
                </DropdownMenuItem>
              )}
            />
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={onOpenMapEditor}>
          <Map className="h-4 w-4 mr-2" />
          Game Levels
        </DropdownMenuItem>
        {currentGameId && canEditCurrentGame ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={`/creator/${currentGameId}/statistics`}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Statistics
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
