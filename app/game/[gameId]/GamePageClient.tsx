'use client';

import { use, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import App from "@/components/App";
import { CollaborationNotice } from "@/components/collaboration/CollaborationNotice";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { useGameStore } from "@/components/default/games";
import { FinishGameView } from "@/components/GameSummary/FinishGameView";
import { GameSummaryView } from "@/components/GameSummary/GameSummaryView";
import { GroupSelector, GroupWaitingRoom, PublicGroupLobby } from "@/components/groups";
import { GameClosingCountdownNotice } from "@/components/game-access/GameClosingCountdownNotice";
import { GameOpeningCountdown } from "@/components/game-access/GameOpeningCountdown";
import { CollaborationProvider, useCollaboration } from "@/lib/collaboration";
import { getCurrentUserFinishState } from "@/lib/gameFinishState";
import { useGameAccessState } from "@/app/game/[gameId]/_hooks/useGameAccessState";
import { useGameGroupFlow } from "@/app/game/[gameId]/_hooks/useGameGroupFlow";
import { useGamePageBootstrap } from "@/app/game/[gameId]/_hooks/useGamePageBootstrap";

interface GamePageProps {
  params: Promise<{
    gameId: string;
  }>;
}

function GameInstancesResetWatcher({ gameId }: { gameId: string }) {
  const collaboration = useCollaboration();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastHandledResetTsRef = useRef<number | null>(null);

  useEffect(() => {
    const resetMessage = collaboration.lastGameInstancesReset;
    if (!resetMessage || resetMessage.gameId !== gameId) {
      return;
    }

    if (lastHandledResetTsRef.current === resetMessage.ts) {
      return;
    }
    lastHandledResetTsRef.current = resetMessage.ts;

    const actorLabel =
      resetMessage.actorUserName ||
      resetMessage.actorUserEmail ||
      "The creator";

    toast.info(`${actorLabel} reset all saved game instances. Rejoining from a fresh game state.`);

    collaboration.disconnect();

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("groupId");
    nextParams.delete("guestId");
    nextParams.set("mode", "game");
    router.replace(`${pathname}?${nextParams.toString()}`);
  }, [collaboration, gameId, pathname, router, searchParams]);

  return null;
}

export default function GamePage({ params }: GamePageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const { setCurrentGameId, addGameToStore } = useGameStore();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const selectedGroupId = searchParams.get("groupId");
  const requestedMode = searchParams.get("mode") === "lobby" ? "lobby" : "game";
  const requestedSkipWaiting = searchParams.get("skipWaiting") === "1";
  const requestedView = searchParams.get("view");
  const requestedUserId = searchParams.get("userId");
  const router = useRouter();
  const pathname = usePathname();
  const { setIsVisible: setSidebarVisible } = useSidebarCollapse();
  const hasUser = Boolean(session?.user);
  const sessionUserId = session?.userId || session?.user?.email || "";
  const [roomId, setRoomId] = useState<string | null>(null);
  const [guestId, setGuestId] = useState("");
  const isReplayView = requestedView === "play";
  const currentGame = useGameStore((state) => {
    if (!state.currentGameId) {
      return null;
    }

    return state.games.find((candidate) => candidate.id === state.currentGameId) ?? null;
  });
  const isCurrentGameResolved = currentGame?.id === gameId;
  const isGroupWorkMode = currentGame?.collaborationMode === "group";
  const canEditCurrentGame = Boolean(currentGame?.canEdit ?? currentGame?.isOwner);

  useEffect(() => {
    if (hasUser || typeof window === "undefined") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const storageKey = "ui-designer-guest-id";
      let nextGuestId = localStorage.getItem(storageKey) || "";
      if (!nextGuestId) {
        nextGuestId = crypto.randomUUID();
        localStorage.setItem(storageKey, nextGuestId);
      }
      setGuestId(nextGuestId);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasUser]);

  const effectiveGuestId = hasUser ? "" : guestId;

  const user = session?.user
    ? {
      id: session.userId || session.user.email || "",
      email: session.user.email || "",
      name: session.user.name ?? undefined,
      image: session.user.image ?? undefined,
    }
    : effectiveGuestId
      ? {
        id: effectiveGuestId,
        email: `guest-${effectiveGuestId}@local`,
        name: "Guest",
        image: undefined,
      }
      : null;

  const currentUserFinishState = getCurrentUserFinishState(
    currentGame?.progressData,
    (user?.id ?? sessionUserId) || null,
  );
  const isFinished = Boolean(currentUserFinishState?.finishedAt);
  const showSummary = isFinished && currentGame?.progressData && requestedView !== "play";
  const showFinishView = requestedView === "finish";
  const gate = currentGame?.progressData?.groupStartGate as Record<string, unknown> | undefined;
  const isStarted = gate?.status === "started";
  const isCreatorPreviewWithoutGroup = isGroupWorkMode && canEditCurrentGame && !selectedGroupId && requestedMode !== "lobby";
  const canSkipWaitingAsCreator = isGroupWorkMode && canEditCurrentGame && Boolean(selectedGroupId);
  const shouldBypassWaitingRoom = canSkipWaitingAsCreator && requestedMode !== "lobby" && requestedSkipWaiting;

  const groupFlow = useGameGroupFlow({
    gameId,
    hasUser,
    sessionEmail: session?.user?.email,
    sessionUserId,
    selectedGroupId,
    pathname,
    searchParamsString,
    router,
    canEditCurrentGame,
    isCurrentGameResolved,
    onRoomResolved: setRoomId,
  });

  const isPublicLobbyActive = Boolean(
    isGroupWorkMode &&
    user &&
    !isStarted &&
    !isCreatorPreviewWithoutGroup &&
    !shouldBypassWaitingRoom,
  );
  const isGameplaySurfaceActive = Boolean(
    currentGame?.id === gameId &&
    !groupFlow.requiresGroup &&
    !showSummary &&
    !showFinishView &&
    !isPublicLobbyActive,
  );

  const accessState = useGameAccessState({
    gameId,
    currentGame,
    isGameplaySurfaceActive,
    setSidebarVisible,
  });

  const bootstrap = useGamePageBootstrap({
    gameId,
    guestId: effectiveGuestId,
    hasUser,
    sessionUserId,
    selectedGroupId,
    requestedMode,
    requestedUserId,
    requestedView,
    pathname,
    searchParamsString,
    isReplayView,
    accessKeyReady: accessState.accessKeyReady,
    submittedAccessKey: accessState.submittedAccessKey,
    reloadNonce: accessState.reloadNonce,
    addGameToStore,
    setCurrentGameId,
    onRoomResolved: setRoomId,
    accessState: {
      clearAccessKeyPrompt: accessState.clearAccessKeyPrompt,
      clearPendingOpenCountdown: accessState.clearPendingOpenCountdown,
      persistSubmittedAccessKey: accessState.persistSubmittedAccessKey,
      setAccessKeyError: accessState.setAccessKeyError,
      setHideSidebar: accessState.setHideSidebar,
      setIsOpeningTransitioning: accessState.setIsOpeningTransitioning,
      showAccessKeyPrompt: accessState.showAccessKeyPrompt,
      showPendingOpenCountdown: accessState.showPendingOpenCountdown,
    },
    groupFlow: {
      resetBootstrapState: groupFlow.resetBootstrapState,
      resolveBootstrapGroupState: groupFlow.resolveBootstrapGroupState,
    },
  });

  const collaborationGroupId =
    selectedGroupId || (roomId?.startsWith("group:") ? roomId.split(":")[1] || null : null);

  if (accessState.pendingOpenAt) {
    return (
      <GameOpeningCountdown
        key={accessState.pendingOpenAt.toISOString()}
        opensAt={accessState.pendingOpenAt}
        timeZone={accessState.pendingOpenTimeZone}
        onReady={accessState.handleCountdownReady}
        isTransitioning={accessState.isOpeningTransitioning}
        loadingMessage={accessState.isOpeningTransitioning ? "Opening game..." : bootstrap.loadingMessage}
      />
    );
  }

  if (bootstrap.isLoading || groupFlow.isResolvingLmsGroups) {
    const activeLoadingMessage = groupFlow.isResolvingLmsGroups
      ? groupFlow.loadingMessage
      : bootstrap.loadingMessage;

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">{activeLoadingMessage}</p>
        </div>
      </div>
    );
  }

  if (bootstrap.error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{bootstrap.error}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please check if the game exists and you have access to it.
          </p>
        </div>
      </div>
    );
  }

  if (groupFlow.requiresGroup) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-4 rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold">Select Group</h2>
          <p className="text-sm text-muted-foreground">
            This game is in Group Work Mode. Choose one of your existing groups to open the shared instance.
          </p>
          <p className="text-sm text-muted-foreground">
            If you do not see the right group yet, create one here or return to the public lobby and coordinate with your teammates.
          </p>
          <GroupSelector
            selectedGroupId={selectedGroupId}
            onGroupSelect={groupFlow.handleGroupSelect}
            allowCreate
            createContext={{ resourceLinkId: gameId }}
            createPlaceholder="Create a group name"
            currentUserId={sessionUserId}
          />
        </div>
      </div>
    );
  }

  if (accessState.requiresAccessKey) {
    return (
      <div className="flex h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-3 rounded border p-6">
          <h2 className="text-xl font-semibold">Access Key Required</h2>
          <p className="text-sm text-muted-foreground">
            This game requires a special key. Ask the creator for the current key.
          </p>
          <input
            type="password"
            className="w-full rounded border px-3 py-2 text-sm"
            value={accessState.accessKeyInput}
            onChange={(event) => accessState.setAccessKeyInput(event.target.value)}
            placeholder="Enter access key"
          />
          {accessState.accessKeyError ? (
            <p className="text-sm text-red-600">{accessState.accessKeyError}</p>
          ) : null}
          <button
            className="w-full rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
            onClick={accessState.continueWithAccessKey}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (showFinishView) {
    return (
      <CollaborationProvider roomId={roomId} groupId={collaborationGroupId} user={user}>
        <CollaborationNotice>
          <GameInstancesResetWatcher gameId={gameId} />
          <FinishGameView gameId={gameId} gameTitle={currentGame?.title} />
        </CollaborationNotice>
      </CollaborationProvider>
    );
  }

  if (showSummary && currentGame) {
    return (
      <GameSummaryView
        gameId={gameId}
        gameTitle={currentGame.title}
        progressData={{
          finishedAt: currentUserFinishState?.finishedAt,
          finalScore: currentUserFinishState?.finalScore,
        }}
        currentUserId={(user?.id ?? sessionUserId) || null}
        isGroupGameplay={Boolean(selectedGroupId)}
      />
    );
  }

  if (isPublicLobbyActive && user) {
    const lobbyRoomId = groupFlow.publicLobby?.roomId || `lobby:all:game:${gameId}`;

    return (
      <CollaborationProvider roomId={lobbyRoomId} groupId={selectedGroupId || null} user={user}>
        <CollaborationNotice>
          <GameInstancesResetWatcher gameId={gameId} />
          <PublicGroupLobby
            gameId={gameId}
            groupId={selectedGroupId}
            gameTitle={currentGame?.title || "Group Game"}
            courseName={groupFlow.publicLobby?.courseName || null}
            currentUser={user}
            onGroupSelect={groupFlow.handleGroupSelect}
            onSkipWaiting={groupFlow.handleCreatorSkipWaiting}
            canSkipWaiting={canSkipWaitingAsCreator}
            lmsGroupPicker={{
              ...groupFlow.lmsGroupPicker,
              onOpenChange: groupFlow.onLmsGroupPickerOpenChange,
              onSelect: (groupId: string) => {
                void groupFlow.resolveLmsGroupSelection(groupId);
              },
            }}
          />
        </CollaborationNotice>
      </CollaborationProvider>
    );
  }

  return (
    <>
      {accessState.shouldShowClosingCountdown && accessState.remainingAccessWindowMs ? (
        <GameClosingCountdownNotice
          remainingMs={accessState.remainingAccessWindowMs}
          onDismiss={accessState.dismissClosingCountdown}
        />
      ) : null}
      <CollaborationProvider roomId={roomId} groupId={collaborationGroupId} user={user}>
        <CollaborationNotice>
          <GameInstancesResetWatcher gameId={gameId} />
          {user && currentGame?.collaborationMode === "group" && roomId?.startsWith("group:") && !shouldBypassWaitingRoom ? (
            <GroupWaitingRoom
              gameTitle={currentGame.title}
              groupId={selectedGroupId || roomId.split(":")[1] || ""}
              groupName={groupFlow.currentGroupName}
              joinKey={groupFlow.currentGroupJoinKey}
              currentUser={user}
              groupMembers={groupFlow.currentGroupMembers}
              onSkipWaiting={groupFlow.handleCreatorSkipWaiting}
              canSkipWaiting={canSkipWaitingAsCreator}
            />
          ) : (
            <App />
          )}
        </CollaborationNotice>
      </CollaborationProvider>
    </>
  );
}
