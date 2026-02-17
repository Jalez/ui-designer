"use client";

import { Loader2 } from "lucide-react";
import type React from "react";
import { GameAccordionItem } from "./GameAccordionItem";
import type { Game } from "./types";

interface GamesListProps {
  games: Game[];
  isLoading: boolean;
  creatingGameId: string | null;
  isCollapsed: boolean;
  editingId: string | null;
  editTitle: string;
  setEditTitle: (title: string) => void;
  onGameClick?: () => void;
  getGameTitle: (game: Game) => string;
  isActive: (gameId: string) => boolean;
  handleKeyPress: (e: React.KeyboardEvent, gameId: string) => void;
  handleCancelEdit: (gameId?: string) => void;
  handleStartEdit: (e: React.MouseEvent, gameId: string, currentTitle: string) => void;
  handleDeleteGame: (e: React.MouseEvent, gameId: string) => Promise<void>;
}

export const GamesList: React.FC<GamesListProps> = ({
  games,
  isLoading,
  creatingGameId,
  isCollapsed,
  editingId,
  editTitle,
  setEditTitle,
  onGameClick,
  getGameTitle,
  isActive,
  handleKeyPress,
  handleCancelEdit,
  handleStartEdit,
  handleDeleteGame,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-12 w-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 w-full text-sm text-muted-foreground">
        No games yet
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-h-[400px] overflow-y-auto">
      {games.map((game) => {
        const gameTitle = getGameTitle(game);
        const active = isActive(game.id);
        const isEditing = editingId === game.id;
        const gameIsLoading = game.id === creatingGameId;

        return (
          <GameAccordionItem
            key={game.id}
            game={game}
            gameTitle={gameTitle}
            active={active}
            isEditing={isEditing}
            isLoading={gameIsLoading}
            isCollapsed={isCollapsed}
            onGameClick={onGameClick}
            editTitle={editTitle}
            setEditTitle={setEditTitle}
            handleKeyPress={handleKeyPress}
            handleCancelEdit={handleCancelEdit}
            handleStartEdit={handleStartEdit}
            handleDeleteGame={handleDeleteGame}
          />
        );
      })}
    </div>
  );
};
