"use client";

import { Edit3, Loader2, MoreVertical, Trash2 } from "lucide-react";
import Link from "next/link";
import type React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Game } from "./types";

interface GameAccordionItemProps {
  game: Game;
  gameTitle: string;
  active: boolean;
  isEditing: boolean;
  isLoading?: boolean;
  isCollapsed: boolean;
  onGameClick?: () => void;
  editTitle: string;
  setEditTitle: (title: string) => void;
  handleKeyPress: (e: React.KeyboardEvent, gameId: string) => void;
  handleCancelEdit: (gameId?: string) => void;
  handleStartEdit: (e: React.MouseEvent, gameId: string, currentTitle: string) => void;
  handleDeleteGame: (e: React.MouseEvent, gameId: string) => Promise<void>;
}

export const GameAccordionItem: React.FC<GameAccordionItemProps> = ({
  game,
  gameTitle,
  active,
  isEditing,
  isLoading = false,
  onGameClick,
  editTitle,
  setEditTitle,
  handleKeyPress,
  handleCancelEdit,
  handleStartEdit,
  handleDeleteGame,
}) => {
  return (
    <div
      className={`w-full border-b border-border flex items-center ${
        active ? "bg-gray-200 dark:bg-muted" : "hover:bg-gray-200 dark:hover:bg-muted"
      }`}
    >
      <div className="relative flex group w-full items-center justify-between">
        <div className="flex-1 min-w-0 overflow-hidden">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e, game.id)}
              onBlur={() => handleCancelEdit(game.id)}
              className="w-full text-sm bg-white dark:bg-gray-700 border border-gray-500 p-3 focus:outline-none focus:ring-1 focus:ring-gray-500"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <Link
              href={`/game/${game.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onGameClick?.();
              }}
              className="text-left text-sm font-medium block w-full min-w-0 p-3 flex items-center gap-2"
              title={gameTitle}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                  <span className="truncate">{gameTitle}</span>
                </>
              ) : (
                <>
                  <span className="truncate flex-1">{gameTitle}</span>
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    {game.mapName}
                  </Badge>
                </>
              )}
            </Link>
          )}
        </div>

        {!isEditing && !isLoading && (
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => handleStartEdit(e, game.id, gameTitle)}
                >
                  <Edit3 className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => handleDeleteGame(e, game.id)}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
};
