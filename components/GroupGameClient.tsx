"use client";

import { useEffect, useState } from "react";
import { CollaborationProvider } from "@/lib/collaboration";
import { useGameStore } from "@/components/default/games";
import App from "@/components/App";
import { useSession } from "next-auth/react";
import { logDebugClient } from "@/lib/debug-logger";
import { setClientStorageScope } from "@/lib/utils/storageScope";

interface GroupUser {
  id: string;
  email: string;
  name?: string;
  image?: string;
}

interface GroupGameClientProps {
  groupId: string;
  gameId: string;
  user: GroupUser;
}

export function GroupGameClient({ groupId, gameId, user: ssrUser }: GroupGameClientProps) {
  const { addGameToStore, setCurrentGameId, getGameById } = useGameStore();
  const [ready, setReady] = useState(false);
  const { data: session, status } = useSession();

  const user: GroupUser = session?.user
    ? {
        id: session.userId || session.user.email || "",
        email: session.user.email || "",
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : ssrUser;

  logDebugClient("group_game_client", {
    groupId,
    gameId,
    ssrUserId: ssrUser.id,
    ssrUserEmail: ssrUser.email,
    sessionStatus: status,
    sessionEmail: session?.user?.email,
    sessionUserId: session?.userId,
    resolvedUserId: user.id,
    resolvedUserEmail: user.email,
  });

  useEffect(() => {
    setClientStorageScope({ userId: user.id, groupId });
  }, [user.id, groupId]);

  useEffect(() => {
    const existing = getGameById(gameId);
    if (existing) {
      setCurrentGameId(gameId);
      setReady(true);
      return;
    }

    fetch(`/api/groups/${groupId}/game`)
      .then((r) => r.json())
      .then(({ game }) => {
        if (game) {
          addGameToStore(game);
          setCurrentGameId(game.id);
        }
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [gameId, groupId, addGameToStore, setCurrentGameId, getGameById]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  logDebugClient("group_game_client_render", {
    groupId,
    userId: user.id,
    userEmail: user.email,
  });

  return (
    <CollaborationProvider groupId={groupId} user={user}>
      <App />
    </CollaborationProvider>
  );
}
