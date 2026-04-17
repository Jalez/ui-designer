"use client";

import { useCallback, useState } from "react";
import { resetLevel } from "@/store/slices/levels.slice";
import { logDebugClient } from "@/lib/debug-logger";
import { toast } from "sonner";

type CollaborationResetApi = {
  resetRoomState?: (scope: "level" | "game", currentLevelIndex: number) => void;
  isConnected?: boolean;
  roomId?: string | null;
  groupId?: string | null;
} | null;

type UseResetActionsParams = {
  collaboration: CollaborationResetApi;
  currentGameId?: string | null;
  currentLevel: number;
  dispatch: (action: unknown) => void;
  isGameRoute: boolean;
  recordReset: (scope: "level" | "game", currentLevelIndex: number) => void;
};

export function useResetActions({
  collaboration,
  currentGameId,
  currentLevel,
  dispatch,
  isGameRoute,
  recordReset,
}: UseResetActionsParams) {
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetScope, setResetScope] = useState<"level" | "game">("level");

  const handleLevelReset = useCallback(() => {
    recordReset("level", currentLevel - 1);
    dispatch(resetLevel(currentLevel));
  }, [currentLevel, dispatch, recordReset]);

  const handleSharedReset = useCallback((scope: "level" | "game") => {
    if (!currentGameId) {
      logDebugClient("shared_reset_ignored_no_game", {
        scope,
        currentLevel: currentLevel - 1,
      });
      return;
    }

    if (collaboration?.resetRoomState) {
      if (!collaboration.isConnected) {
        logDebugClient("shared_reset_blocked_disconnected", {
          scope,
          currentLevel: currentLevel - 1,
          roomId: collaboration.roomId,
          groupId: collaboration.groupId,
        });
        toast.error("Shared reset is unavailable until the room connection is ready.");
        return;
      }

      recordReset(scope, currentLevel - 1);
      logDebugClient("shared_reset_emit", {
        scope,
        currentLevel: currentLevel - 1,
        roomId: collaboration.roomId,
        groupId: collaboration.groupId,
      });
      collaboration.resetRoomState(scope, currentLevel - 1);
      return;
    }

    recordReset(scope, currentLevel - 1);
    logDebugClient("shared_reset_fallback_local", {
      scope,
      currentLevel: currentLevel - 1,
      isGameRoute,
      roomId: collaboration?.roomId ?? null,
      groupId: collaboration?.groupId ?? null,
    });
    if (scope === "level") {
      dispatch(resetLevel(currentLevel));
    }
  }, [collaboration, currentGameId, currentLevel, dispatch, isGameRoute, recordReset]);

  const shouldUseSharedReset = isGameRoute && Boolean(collaboration?.resetRoomState);

  const toggleResetDialog = useCallback((scope: "level" | "game" = "level") => {
    setResetScope(scope);
    setIsResetDialogOpen(true);
  }, []);

  const closeResetDialog = useCallback(() => {
    setIsResetDialogOpen(false);
  }, []);

  const confirmReset = useCallback(() => {
    if (shouldUseSharedReset) {
      handleSharedReset(resetScope);
      return;
    }
    handleLevelReset();
  }, [handleLevelReset, handleSharedReset, resetScope, shouldUseSharedReset]);

  return {
    closeResetDialog,
    confirmReset,
    handleLevelReset,
    handleSharedReset,
    isResetDialogOpen,
    resetScope,
    shouldUseSharedReset,
    toggleResetDialog,
  };
}
