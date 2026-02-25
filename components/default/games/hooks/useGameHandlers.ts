import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { useGameStore } from "../stores/gameStore";
import { useNotificationStore } from "@/components/default/notifications";

interface UseGameHandlersProps {
  isAuthenticated: boolean;
  onGameClick?: () => void;
}

export const useGameHandlers = ({ isAuthenticated, onGameClick }: UseGameHandlersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const { updateGame, removeGame, createGame: createGameInStore } = useGameStore();
  const { showError, showSuccess, showLoading, hideNotification } = useNotificationStore();
  const [isCreating, setIsCreating] = useState(false);
  const [creatingGameId, setCreatingGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!creatingGameId) return;
    
    if (pathname === `/game/${creatingGameId}`) {
      const timer = setTimeout(() => {
        setIsCreating(false);
        setCreatingGameId(null);
      }, 300);
      return () => clearTimeout(timer);
    } else if (pathname && pathname !== `/game/${creatingGameId}` && !pathname.startsWith(`/game/${creatingGameId}/`)) {
      const timer = setTimeout(() => {
        setIsCreating(false);
        setCreatingGameId(null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [creatingGameId, pathname]);

  const handleCreateGame = useCallback(async (mapName: string = "all") => {
    if (isCreating) return;
    
    if (!isAuthenticated) {
      showError("Authentication required to create games");
      return;
    }

    try {
      setIsCreating(true);
      showLoading("Creating game...");

      const userId = session?.userId || session?.user?.email || "";

      const newGame = await createGameInStore(userId, mapName, "New Game");

      hideNotification();
      showSuccess("Game created successfully!");
      
      setCreatingGameId(newGame.id);
      router.push(`/game/${newGame.id}`);
      
      if (onGameClick) {
        onGameClick();
      }
    } catch (error) {
      console.error("Error creating game:", error);
      showError(error instanceof Error ? error.message : "Failed to create game");
      hideNotification();
      setIsCreating(false);
      setCreatingGameId(null);
    }
  }, [isAuthenticated, session, router, onGameClick, isCreating, createGameInStore, showError, showSuccess, showLoading, hideNotification]);

  const handleSaveEdit = useCallback(
    async (e: React.MouseEvent, gameId: string, editTitle: string) => {
      e.stopPropagation();
      try {
        await updateGame(gameId, { title: editTitle });
      } catch (error) {
        console.error("Failed to save game title:", error);
      }
    },
    [updateGame]
  );

  const handleCancelEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleDeleteGame = useCallback(
    async (e: React.MouseEvent, gameId: string) => {
      e.stopPropagation();
      
      if (!confirm("Are you sure you want to delete this game? This action cannot be undone.")) {
        return;
      }

      try {
        await removeGame(gameId);
        
        if (pathname === `/game/${gameId}` || pathname?.startsWith(`/game/${gameId}/`)) {
          router.push("/");
        }
      } catch (error) {
        console.error("Failed to delete game:", error);
      }
    },
    [removeGame, pathname, router]
  );

  return {
    handleCreateGame,
    handleSaveEdit,
    handleCancelEdit,
    handleDeleteGame,
    isCreating,
    creatingGameId,
  };
};
