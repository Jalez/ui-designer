'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "@/components/default/games/types";
import { apiUrl } from "@/lib/apiUrl";
import { logDebugClient } from "@/lib/debug-logger";
import { fetchGroupDetailsCached } from "@/lib/group-details-client";
import type { ClientGroupMember } from "@/lib/group-details-client";

export interface LtiSessionInfo {
  isLtiMode: boolean;
  isInIframe?: boolean;
  courseName: string | null;
  contextId: string | null;
  role?: "instructor" | "member";
}

export type PersistedGroupMember = ClientGroupMember;

export interface LmsGroupOption {
  id: string;
  memberNames: string[];
  timestamp: string | null;
}

export type PublicLobbyState = {
  roomId: string;
  courseName: string | null;
  contextId: string | null;
};

type LmsGroupPickerState = {
  open: boolean;
  loading: boolean;
  groups: LmsGroupOption[];
  error: string | null;
};

type RouterLike = {
  push: (href: string) => void;
};

function getPublicLobbyRoomId(gameId: string, contextId: string | null, courseName: string | null): string {
  const scope = (contextId || courseName || "all").trim();
  return `lobby:${encodeURIComponent(scope)}:game:${gameId}`;
}

function normalizeLmsGroups(payload: unknown): LmsGroupOption[] {
  const rawGroups =
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      Array.isArray((payload as { groups?: unknown[] }).groups)
      ? (payload as { groups: unknown[] }).groups
      : [];

  return rawGroups
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }

      const candidate = entry as {
        id?: string | number;
        members?: unknown[];
        timestamp?: unknown;
      };
      const id = candidate.id == null ? "" : String(candidate.id).trim();
      if (!id) {
        return null;
      }

      return {
        id,
        memberNames: Array.isArray(candidate.members)
          ? candidate.members.filter((member): member is string => typeof member === "string" && member.length > 0)
          : [],
        timestamp: typeof candidate.timestamp === "string" ? candidate.timestamp : null,
      };
    })
    .filter((entry): entry is LmsGroupOption => Boolean(entry));
}

export function useGameGroupFlow({
  gameId,
  hasUser,
  sessionEmail,
  sessionUserId,
  selectedGroupId,
  pathname,
  searchParamsString,
  router,
  canEditCurrentGame,
  isCurrentGameResolved,
  onRoomResolved,
}: {
  gameId: string;
  hasUser: boolean;
  sessionEmail: string | null | undefined;
  sessionUserId: string;
  selectedGroupId: string | null;
  pathname: string;
  searchParamsString: string;
  router: RouterLike;
  canEditCurrentGame: boolean;
  isCurrentGameResolved: boolean;
  onRoomResolved: (roomId: string | null) => void;
}) {
  const [requiresGroup, setRequiresGroup] = useState(false);
  const [publicLobby, setPublicLobby] = useState<PublicLobbyState | null>(null);
  const [ltiSessionInfo, setLtiSessionInfo] = useState<LtiSessionInfo | null>(null);
  const [currentGroupName, setCurrentGroupName] = useState<string | null>(null);
  const [currentGroupJoinKey, setCurrentGroupJoinKey] = useState<string | null>(null);
  const [currentGroupMembers, setCurrentGroupMembers] = useState<PersistedGroupMember[]>([]);
  const [lmsGroupPicker, setLmsGroupPicker] = useState<LmsGroupPickerState>({
    open: false,
    loading: false,
    groups: [],
    error: null,
  });
  const [isResolvingLmsGroups, setIsResolvingLmsGroups] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading game...");
  const iframeGroupRequestSettledRef = useRef(false);

  const resetBootstrapState = useCallback(() => {
    setRequiresGroup(false);
    setLtiSessionInfo(null);
  }, []);

  const handleGroupSelect = useCallback(async (groupId: string | null, options?: { joinKey?: string }) => {
    if (!groupId) {
      const normalizedParams = new URLSearchParams(searchParamsString);
      normalizedParams.delete("groupId");
      normalizedParams.delete("skipWaiting");
      normalizedParams.set("mode", "lobby");
      router.push(`${pathname}?${normalizedParams.toString()}`);
      setCurrentGroupName(null);
      setCurrentGroupJoinKey(null);
      setCurrentGroupMembers([]);
      onRoomResolved(publicLobby?.roomId ?? `lobby:all:game:${gameId}`);
      return;
    }

    if (hasUser && sessionEmail) {
      const membershipResponse = await fetch(apiUrl(`/api/groups/${groupId}/members`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinKey: options?.joinKey,
        }),
      });

      if (!membershipResponse.ok) {
        const membershipData = await membershipResponse.json().catch(() => ({}));
        throw new Error(membershipData.error || "Failed to join group");
      }
    }

    try {
      const data = await fetchGroupDetailsCached(groupId, {
        gameId,
        preferCreatorAccess: canEditCurrentGame,
      });
      setCurrentGroupName(data.group?.name ?? null);
      setCurrentGroupJoinKey(data.group?.joinKey ?? null);
      setCurrentGroupMembers(Array.isArray(data.members) ? data.members : []);
      logDebugClient("group_join_success", {
        groupId,
        groupName: data.group?.name ?? null,
        joinKey: data.group?.joinKey ?? null,
        memberNames: Array.isArray(data.members)
          ? data.members.map((member: { userName?: string; userEmail?: string; userId?: string }) => member.userName || member.userEmail || member.userId || "unknown")
          : [],
        href: typeof window !== "undefined" ? window.location.href : null,
      });
    } catch {
      setCurrentGroupName(null);
      setCurrentGroupJoinKey(null);
      setCurrentGroupMembers([]);
    }

    const normalizedParams = new URLSearchParams(searchParamsString);
    normalizedParams.set("mode", "game");
    normalizedParams.set("groupId", groupId);
    normalizedParams.delete("skipWaiting");
    router.push(`${pathname}?${normalizedParams.toString()}`);
    setRequiresGroup(false);
  }, [canEditCurrentGame, gameId, hasUser, onRoomResolved, pathname, publicLobby?.roomId, router, searchParamsString, sessionEmail]);

  const resolveLmsGroupSelection = useCallback(async (lmsGroupId: string) => {
    setIsResolvingLmsGroups(true);
    setLoadingMessage("Opening LMS group...");
    setLmsGroupPicker((current) => ({
      ...current,
      error: null,
    }));

    try {
      const response = await fetch(apiUrl(`/api/games/${gameId}/lti-groups/resolve`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lmsGroupId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.groupId) {
        throw new Error(payload.error || "Failed to open LMS group");
      }

      await handleGroupSelect(payload.groupId);
      setLmsGroupPicker({
        open: false,
        loading: false,
        groups: [],
        error: null,
      });
    } catch (err) {
      setLmsGroupPicker((current) => ({
        ...current,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to open LMS group",
      }));
    } finally {
      setIsResolvingLmsGroups(false);
    }
  }, [gameId, handleGroupSelect]);

  const handleCreatorSkipWaiting = useCallback(() => {
    if (!selectedGroupId) {
      return;
    }

    const normalizedParams = new URLSearchParams(searchParamsString);
    normalizedParams.set("mode", "game");
    normalizedParams.set("groupId", selectedGroupId);
    normalizedParams.set("skipWaiting", "1");
    router.push(`${pathname}?${normalizedParams.toString()}`);
  }, [pathname, router, searchParamsString, selectedGroupId]);

  const resolveBootstrapGroupState = useCallback(async ({
    game,
    requestedMode,
    setBootstrapLoadingMessage,
    onGameReady,
  }: {
    game: Game;
    requestedMode: "game" | "lobby";
    setBootstrapLoadingMessage: (message: string) => void;
    onGameReady: (game: Game, roomId: string) => void;
  }): Promise<boolean> => {
    if (game.collaborationMode !== "group") {
      return false;
    }

    if (!hasUser) {
      throw new Error("Authentication required for group games");
    }

    const canOpenCreatorPreview = Boolean(game.canEdit);
    const shouldOpenCreatorLobby = canOpenCreatorPreview && !selectedGroupId && requestedMode === "lobby";

    if ((!selectedGroupId && !canOpenCreatorPreview) || shouldOpenCreatorLobby) {
      let nextLtiInfo: LtiSessionInfo | null = null;
      try {
        setBootstrapLoadingMessage("Resolving your group from the course workspace...");
        const ltiResponse = await fetch(apiUrl("/api/games/lti-session"));
        if (ltiResponse.ok) {
          nextLtiInfo = await ltiResponse.json();
        }
      } catch {
        // Ignore LTI session probe failures and fall back to the normal group picker.
      }
      setLtiSessionInfo(nextLtiInfo);

      if (nextLtiInfo?.isLtiMode || shouldOpenCreatorLobby) {
        setBootstrapLoadingMessage("Opening group lobby...");
        const lobbyRoomId = getPublicLobbyRoomId(gameId, nextLtiInfo?.contextId ?? null, nextLtiInfo?.courseName ?? null);
        setPublicLobby({
          roomId: lobbyRoomId,
          courseName: nextLtiInfo?.courseName ?? null,
          contextId: nextLtiInfo?.contextId ?? null,
        });
        onGameReady(game, lobbyRoomId);
      } else {
        setRequiresGroup(true);
      }

      return true;
    }

    return false;
  }, [gameId, hasUser, selectedGroupId]);

  useEffect(() => {
    if (
      iframeGroupRequestSettledRef.current ||
      selectedGroupId ||
      !publicLobby ||
      !ltiSessionInfo?.isLtiMode ||
      !ltiSessionInfo?.isInIframe ||
      typeof window === "undefined" ||
      window.parent === window
    ) {
      return;
    }

    const requestId = `edu-game-groups-${gameId}-${Date.now()}`;
    let finished = false;

    setLmsGroupPicker({
      open: false,
      loading: true,
      groups: [],
      error: null,
    });
    setIsResolvingLmsGroups(true);
    setLoadingMessage("Resolving your LMS groups...");

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object" || Array.isArray(data) || data.requestId !== requestId) {
        return;
      }

      if (data.type === "edu-game-groups-loading") {
        setLmsGroupPicker((current) => ({
          ...current,
          open: false,
          loading: true,
          error: null,
        }));
        return;
      }

      if (data.type !== "edu-game-groups-data") {
        return;
      }

      finished = true;
      iframeGroupRequestSettledRef.current = true;
      window.removeEventListener("message", handleMessage);
      const normalizedGroups = normalizeLmsGroups(data.groups);

      if (!data.success || normalizedGroups.length === 0) {
        setIsResolvingLmsGroups(false);
        setLmsGroupPicker({
          open: false,
          loading: false,
          groups: [],
          error: null,
        });
        return;
      }

      if (normalizedGroups.length === 1) {
        void resolveLmsGroupSelection(normalizedGroups[0].id);
        return;
      }

      setIsResolvingLmsGroups(false);
      setLmsGroupPicker({
        open: true,
        loading: false,
        groups: normalizedGroups,
        error: null,
      });
    };

    const timeoutId = window.setTimeout(() => {
      if (finished) {
        return;
      }

      iframeGroupRequestSettledRef.current = true;
      setIsResolvingLmsGroups(false);
      window.removeEventListener("message", handleMessage);
      setLmsGroupPicker({
        open: false,
        loading: false,
        groups: [],
        error: null,
      });
    }, 5000);

    window.addEventListener("message", handleMessage);
    window.parent.postMessage({
      type: "edu-game-get-groups",
      requestId,
    }, "*");

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("message", handleMessage);
    };
  }, [gameId, ltiSessionInfo, publicLobby, resolveLmsGroupSelection, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroupId || !hasUser || !isCurrentGameResolved) {
      return;
    }

    let cancelled = false;
    const loadGroupDetails = async () => {
      try {
        const data = await fetchGroupDetailsCached(selectedGroupId, {
          gameId,
          preferCreatorAccess: canEditCurrentGame,
        });
        if (cancelled) {
          return;
        }

        setCurrentGroupName(data.group?.name ?? null);
        setCurrentGroupJoinKey(data.group?.joinKey ?? null);
        setCurrentGroupMembers(Array.isArray(data.members) ? data.members : []);
      } catch {
        if (!cancelled) {
          setCurrentGroupName(null);
          setCurrentGroupJoinKey(null);
          setCurrentGroupMembers([]);
        }
      }
    };

    void loadGroupDetails();
    return () => {
      cancelled = true;
    };
  }, [canEditCurrentGame, gameId, hasUser, isCurrentGameResolved, selectedGroupId]);

  return {
    requiresGroup,
    publicLobby,
    ltiSessionInfo,
    currentGroupName,
    currentGroupJoinKey,
    currentGroupMembers,
    lmsGroupPicker,
    isResolvingLmsGroups,
    loadingMessage,
    resetBootstrapState,
    resolveBootstrapGroupState,
    handleGroupSelect,
    resolveLmsGroupSelection,
    handleCreatorSkipWaiting,
    setLmsGroupPicker,
    onLmsGroupPickerOpenChange: (open: boolean) => {
      setLmsGroupPicker((current) => ({
        ...current,
        open,
      }));
    },
    currentUserId: sessionUserId,
  };
}
