'use client';

import { useEffect, useRef, useState } from "react";
import type { Game } from "@/components/default/games/types";
import { apiUrl } from "@/lib/apiUrl";
import { logDebugClient } from "@/lib/debug-logger";
import { evaluateAccessWindows, getNextAccessWindowStart } from "@/lib/gameAccessWindows";
import { sanitizeReplayProgressData } from "@/lib/gameplay/sanitizeReplayProgressData";

function getRoomIdForInstance(
  gameId: string,
  instance: { scope?: string; groupId?: string | null; userId?: string | null } | null | undefined,
): string | null {
  if (!instance) {
    return null;
  }

  if (instance.scope === "group" && instance.groupId) {
    return `group:${instance.groupId}:game:${gameId}`;
  }

  if (instance.scope === "individual" && instance.userId) {
    return `individual:${instance.userId}:game:${gameId}`;
  }

  return null;
}

export function useGamePageBootstrap({
  gameId,
  guestId,
  hasUser,
  sessionUserId,
  selectedGroupId,
  requestedMode,
  requestedUserId,
  requestedView,
  pathname,
  searchParamsString,
  isReplayView,
  accessKeyReady,
  submittedAccessKey,
  reloadNonce,
  addGameToStore,
  setCurrentGameId,
  onRoomResolved,
  accessState,
  groupFlow,
}: {
  gameId: string;
  guestId: string;
  hasUser: boolean;
  sessionUserId: string;
  selectedGroupId: string | null;
  requestedMode: "game" | "lobby";
  requestedUserId: string | null;
  requestedView: string | null;
  pathname: string;
  searchParamsString: string;
  isReplayView: boolean;
  accessKeyReady: boolean;
  submittedAccessKey: string;
  reloadNonce: number;
  addGameToStore: (game: Game) => void;
  setCurrentGameId: (gameId: string) => void;
  onRoomResolved: (roomId: string | null) => void;
  accessState: {
    clearAccessKeyPrompt: () => void;
    clearPendingOpenCountdown: () => void;
    persistSubmittedAccessKey: () => void;
    setAccessKeyError: (value: string | null) => void;
    setHideSidebar: (value: boolean) => void;
    setIsOpeningTransitioning: (value: boolean) => void;
    showAccessKeyPrompt: (error: string, hideSidebar?: boolean) => void;
    showPendingOpenCountdown: (opensAt: Date | null, timeZone: string | null) => void;
  };
  groupFlow: {
    resetBootstrapState: () => void;
    resolveBootstrapGroupState: (options: {
      game: Game;
      requestedMode: "game" | "lobby";
      setBootstrapLoadingMessage: (message: string) => void;
      onGameReady: (game: Game, roomId: string) => void;
    }) => Promise<boolean>;
  };
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading game...");
  const [error, setError] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);
  const initializedGroupIdRef = useRef<string | null>(null);
  const initializedModeRef = useRef<"game" | "lobby" | null>(null);
  const initializedViewRef = useRef<string | null>(null);
  const {
    clearAccessKeyPrompt,
    clearPendingOpenCountdown,
    persistSubmittedAccessKey,
    setAccessKeyError,
    setHideSidebar,
    setIsOpeningTransitioning,
    showAccessKeyPrompt,
    showPendingOpenCountdown,
  } = accessState;
  const {
    resetBootstrapState,
    resolveBootstrapGroupState,
  } = groupFlow;

  useEffect(() => {
    const initializeGame = async () => {
      if (!accessKeyReady) {
        return;
      }
      if (!hasUser && !guestId) {
        return;
      }

      try {
        const isSwitchingGroup =
          hasInitializedRef.current &&
          initializedGroupIdRef.current !== selectedGroupId;
        const isModeTransition =
          hasInitializedRef.current &&
          initializedModeRef.current !== requestedMode;
        const isViewTransition =
          hasInitializedRef.current &&
          initializedViewRef.current !== requestedView;

        if (!hasInitializedRef.current || isSwitchingGroup || isModeTransition || isViewTransition || reloadNonce > 0) {
          setIsLoading(true);
          setLoadingMessage("Loading game...");
        }

        setError(null);
        resetBootstrapState();
        clearAccessKeyPrompt();
        setAccessKeyError(null);

        const normalizedParams = new URLSearchParams(searchParamsString);
        if (normalizedParams.get("mode") !== requestedMode) {
          normalizedParams.set("mode", requestedMode);
          history.replaceState(null, "", `${pathname}?${normalizedParams.toString()}`);
        }

        const gameParams = new URLSearchParams();
        gameParams.set("accessContext", "game");
        if (submittedAccessKey) {
          gameParams.set("key", submittedAccessKey);
        }
        const gameRes = await fetch(apiUrl(`/api/games/${gameId}${gameParams.toString() ? `?${gameParams.toString()}` : ""}`));
        if (!gameRes.ok) {
          const payload = await gameRes.json().catch(() => ({}));
          if (gameRes.status === 403 && payload.reason === "not_started") {
            const nextOpenAt = getNextAccessWindowStart({
              enabled: Boolean(payload.accessWindowEnabled),
              timeZone: typeof payload.accessWindowTimezone === "string" ? payload.accessWindowTimezone : null,
              windows: payload.accessWindows,
              legacyStartsAt: typeof payload.accessStartsAt === "string" ? payload.accessStartsAt : null,
            });
            showPendingOpenCountdown(nextOpenAt, typeof payload.accessWindowTimezone === "string" ? payload.accessWindowTimezone : null);
            setError(nextOpenAt ? null : (payload.error || "Game is not open yet"));
            setIsLoading(false);
            return;
          }

          if (gameRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
            showAccessKeyPrompt(payload.error || "Access key required", payload.hideSidebar ?? false);
            setIsLoading(false);
            return;
          }

          clearPendingOpenCountdown();
          setError(payload.error || payload.message || "Game not found");
          setIsLoading(false);
          return;
        }

        const game = await gameRes.json() as Game;
        setHideSidebar(Boolean(game?.hideSidebar));
        persistSubmittedAccessKey();

        const accessWindowState = evaluateAccessWindows({
          enabled: Boolean(game?.accessWindowEnabled),
          timeZone: game?.accessWindowTimezone,
          windows: game?.accessWindows,
          legacyStartsAt: game?.accessStartsAt,
          legacyEndsAt: game?.accessEndsAt,
        });
        if (accessWindowState === "not_started") {
          const nextOpenAt = getNextAccessWindowStart({
            enabled: Boolean(game?.accessWindowEnabled),
            timeZone: game?.accessWindowTimezone,
            windows: game?.accessWindows,
            legacyStartsAt: game?.accessStartsAt,
          });
          showPendingOpenCountdown(nextOpenAt, game?.accessWindowTimezone ?? null);
          setError(nextOpenAt ? null : "Game is not open yet");
          setIsLoading(false);
          return;
        }

        if (accessWindowState === "expired") {
          clearPendingOpenCountdown();
          setError("Game access windows have ended");
          setIsLoading(false);
          return;
        }

        if (game?.accessKeyRequired && !submittedAccessKey) {
          showAccessKeyPrompt("Access key required", Boolean(game?.hideSidebar));
          setIsLoading(false);
          return;
        }

        const handledByGroupFlow = await resolveBootstrapGroupState({
          game,
          requestedMode,
          setBootstrapLoadingMessage: setLoadingMessage,
          onGameReady: (nextGame, roomId) => {
            addGameToStore(nextGame);
            setCurrentGameId(gameId);
            onRoomResolved(roomId);
            logDebugClient("room_resolution_lti_lobby", {
              gameId,
              roomId,
              href: typeof window !== "undefined" ? window.location.href : null,
            });
          },
        });
        if (handledByGroupFlow) {
          hasInitializedRef.current = true;
          initializedGroupIdRef.current = selectedGroupId;
          initializedModeRef.current = requestedMode;
          initializedViewRef.current = requestedView;
          clearPendingOpenCountdown();
          setIsOpeningTransitioning(false);
          setIsLoading(false);
          return;
        }

        if (game.collaborationMode === "group") {
          const instanceParams = new URLSearchParams();
          instanceParams.set("accessContext", "game");
          if (selectedGroupId) {
            instanceParams.set("groupId", selectedGroupId);
          }
          if (!hasUser && guestId) {
            instanceParams.set("guestId", guestId);
          }
          if (submittedAccessKey) {
            instanceParams.set("key", submittedAccessKey);
          }

          setLoadingMessage("Opening shared group game...");
          const instanceRes = await fetch(apiUrl(`/api/games/${gameId}/instance?${instanceParams.toString()}`));
          if (!instanceRes.ok) {
            const payload = await instanceRes.json().catch(() => ({}));
            if (instanceRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
              showAccessKeyPrompt(payload.error || "Access key required");
              setIsLoading(false);
              return;
            }

            setError(payload.error || "Failed to load group game instance");
            setIsLoading(false);
            return;
          }

          const instancePayload = await instanceRes.json();
          const rawProgressData =
            instancePayload.instance?.progressData &&
              typeof instancePayload.instance.progressData === "object" &&
              !Array.isArray(instancePayload.instance.progressData)
              ? instancePayload.instance.progressData
              : {};
          const progressData = sanitizeReplayProgressData(rawProgressData, isReplayView, {
            stripLevels: false,
          });
          addGameToStore({ ...game, progressData });
          const nextRoomId = getRoomIdForInstance(gameId, instancePayload.instance);
          onRoomResolved(nextRoomId);
          logDebugClient("room_resolution_group_instance", {
            gameId,
            groupId: selectedGroupId,
            roomId: nextRoomId,
            instanceId: instancePayload.instance?.id ?? null,
            href: typeof window !== "undefined" ? window.location.href : null,
          });
        } else {
          const instanceParams = new URLSearchParams();
          instanceParams.set("accessContext", "game");
          if (!hasUser && guestId) {
            instanceParams.set("guestId", guestId);
          }
          if (submittedAccessKey) {
            instanceParams.set("key", submittedAccessKey);
          }
          if (requestedUserId && game.canEdit) {
            instanceParams.set("userId", requestedUserId);
          }

          setLoadingMessage("Opening game...");
          const instanceRes = await fetch(apiUrl(`/api/games/${gameId}/instance${instanceParams.toString() ? `?${instanceParams.toString()}` : ""}`));
          if (instanceRes.ok) {
            const instancePayload = await instanceRes.json();
            const rawProgressData =
              instancePayload.instance?.progressData &&
                typeof instancePayload.instance.progressData === "object" &&
                !Array.isArray(instancePayload.instance.progressData)
                ? instancePayload.instance.progressData
                : {};
            const progressData = sanitizeReplayProgressData(rawProgressData, isReplayView, {
              stripLevels: false,
            });
            addGameToStore({ ...game, progressData });
            const nextRoomId = getRoomIdForInstance(gameId, instancePayload.instance);
            onRoomResolved(nextRoomId);
            logDebugClient("room_resolution_individual_instance", {
              gameId,
              roomId: nextRoomId,
              instanceId: instancePayload.instance?.id ?? null,
              href: typeof window !== "undefined" ? window.location.href : null,
            });
          } else {
            const payload = await instanceRes.json().catch(() => ({}));
            if (instanceRes.status === 403 && (payload.requiresAccessKey || payload.reason === "access_key_required" || payload.reason === "access_key_invalid")) {
              showAccessKeyPrompt(payload.error || "Access key required");
              setIsLoading(false);
              return;
            }

            addGameToStore(game);
            const userId = hasUser ? sessionUserId : guestId;
            const nextRoomId = `individual:${userId}:game:${gameId}`;
            onRoomResolved(nextRoomId);
            logDebugClient("room_resolution_individual_fallback", {
              gameId,
              roomId: nextRoomId,
              href: typeof window !== "undefined" ? window.location.href : null,
            });
          }
        }

        hasInitializedRef.current = true;
        initializedGroupIdRef.current = selectedGroupId;
        initializedModeRef.current = requestedMode;
        initializedViewRef.current = requestedView;
        setCurrentGameId(gameId);
        clearPendingOpenCountdown();
        setIsOpeningTransitioning(false);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading game:", err);
        clearPendingOpenCountdown();
        setIsOpeningTransitioning(false);
        setError(err instanceof Error ? err.message : "Failed to load game");
        setIsLoading(false);
      }
    };

    void initializeGame();
  }, [
    accessKeyReady,
    addGameToStore,
    clearAccessKeyPrompt,
    clearPendingOpenCountdown,
    gameId,
    guestId,
    hasUser,
    isReplayView,
    onRoomResolved,
    pathname,
    persistSubmittedAccessKey,
    reloadNonce,
    requestedMode,
    requestedUserId,
    requestedView,
    resetBootstrapState,
    searchParamsString,
    selectedGroupId,
    sessionUserId,
    setAccessKeyError,
    setCurrentGameId,
    setHideSidebar,
    setIsOpeningTransitioning,
    showAccessKeyPrompt,
    showPendingOpenCountdown,
    submittedAccessKey,
    resolveBootstrapGroupState,
  ]);

  return {
    isLoading,
    loadingMessage,
    error,
  };
}
