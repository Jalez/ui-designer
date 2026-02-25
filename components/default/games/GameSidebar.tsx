"use client";

import { FolderKanban, Loader2, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { SidebarButton } from "../sidebar/SidebarButton";
import { SidebarLink } from "../sidebar/SidebarLink";
import { useSidebarCollapse } from "../sidebar/context/SidebarCollapseContext";
import { useMobileSidebar } from "../sidebar/Sidebar";
import { useGameStore } from "./stores/gameStore";
import { GamesList } from "./GamesList";
import { useGameHandlers } from "./hooks/useGameHandlers";
import type { Game } from "./types";

interface SidebarGameListProps {
  onGameClick?: () => void;
  isUserAdmin: boolean;
}

export const GameSidebar: React.FC<SidebarGameListProps> = ({ onGameClick, isUserAdmin }) => {
  const { isCollapsed: contextCollapsed } = useSidebarCollapse();
  const isMobileSidebar = useMobileSidebar();
  const isCollapsed = isMobileSidebar ? false : contextCollapsed;
  const pathname = usePathname();
  const { data: session } = useSession();
  const { games, loadGames } = useGameStore();
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedGames, setHasLoadedGames] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const isAuthenticated = !!session?.user;

  const { handleCreateGame, handleSaveEdit, handleDeleteGame, isCreating, creatingGameId } = useGameHandlers({
    isAuthenticated,
    onGameClick,
  });

  useEffect(() => {
    const loadGms = async () => {
      if (isAuthenticated && !hasLoadedGames && session?.user?.email && (!isCollapsed || isSearchModalOpen)) {
        setIsLoading(true);
        try {
          await loadGames();
          setHasLoadedGames(true);
        } catch (error) {
          console.error("Error loading games:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadGms();
  }, [isAuthenticated, hasLoadedGames, session?.user?.email, loadGames, isCollapsed, isSearchModalOpen]);

  const isActive = (gameId: string) => {
    return pathname === `/game/${gameId}`;
  };

  const getGameTitle = (game: Game) => {
    return game.title || "Untitled Game";
  };

  const handleKeyPress = useCallback(
    async (e: React.KeyboardEvent, gameId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await handleSaveEdit(e as unknown as React.MouseEvent, gameId, editTitle);
        setEditingId(null);
        setEditTitle("");
      } else if (e.key === "Escape") {
        setEditingId(null);
        setEditTitle("");
      }
    },
    [editTitle, handleSaveEdit]
  );

  const handleCancelEditWrapper = useCallback(
    async (gameId?: string) => {
      if (gameId && editTitle !== "") {
        await handleSaveEdit({} as React.MouseEvent, gameId, editTitle);
      }
      setEditingId(null);
      setEditTitle("");
    },
    [editTitle, handleSaveEdit]
  );

  const handleStartEdit = useCallback((e: React.MouseEvent, gameId: string, currentTitle: string) => {
    e.stopPropagation();
    setEditingId(gameId);
    setEditTitle(currentTitle);
  }, []);

  const handleDeleteGameWrapper = useCallback(
    async (e: React.MouseEvent, gameId: string) => {
      await handleDeleteGame(e, gameId);
    },
    [handleDeleteGame]
  );

  return (
    <>
      <SidebarLink
        icon={<FolderKanban className="h-5 w-5" />}
        label="Games"
        description="Browse public games"
        href="/games"
        onClick={onGameClick}
        isActive={pathname === "/games"}
        isCollapsed={isCollapsed}
        title="Games"
      />
      
      <SidebarButton
        icon={isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        label="New Game"
        isCollapsed={isCollapsed}
        onClick={() => handleCreateGame("all")}
        tooltip={isAuthenticated ? "New Game" : "Sign in to create games"}
        disabled={!isAuthenticated}
      />

      {isCollapsed ? (
        <SidebarButton
          icon={<Search className="h-5 w-5" />}
          isCollapsed={true}
          onClick={() => setIsSearchModalOpen(true)}
          tooltip="Search Games"
        />
      ) : (
        <GamesList
          games={games}
          isLoading={isLoading}
          creatingGameId={creatingGameId}
          isCollapsed={isCollapsed}
          editingId={editingId}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          onGameClick={onGameClick}
          getGameTitle={getGameTitle}
          isActive={isActive}
          handleKeyPress={handleKeyPress}
          handleCancelEdit={handleCancelEditWrapper}
          handleStartEdit={handleStartEdit}
          handleDeleteGame={handleDeleteGameWrapper}
        />
      )}
    </>
  );
};
