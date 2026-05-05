'use client';

import { use, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { CollaborationProvider } from "@/lib/collaboration";
import { CollaborationNotice } from "@/components/collaboration/CollaborationNotice";

interface CreatorPageProps {
  params: Promise<{
    gameId: string;
  }>;
}

export default function CreatorPage({ params }: CreatorPageProps) {
  const { gameId } = use(params);
  const { data: session } = useSession();
  const router = useRouter();
  const hasUser = Boolean(session?.user);
  const { loadGameById, setCurrentGameId } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const initializedGameIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasUser) {
      setIsLoading(false);
      return;
    }

    // Only run initialization once per gameId — re-runs from dep changes
    // (session refetch, store updates) must NOT set isLoading=true, because
    // that unmounts CollaborationProvider and kills the WebSocket connection.
    if (initializedGameIdRef.current === gameId) {
      return;
    }

    const initializeGame = async () => {
      try {
        const game = await loadGameById(gameId);
        if (!game) {
          setError("Game not found");
          setIsLoading(false);
          return;
        }

        const canEdit = Boolean(game.canEdit || game.isOwner);
        if (!canEdit) {
          router.replace(`/game/${gameId}`);
          setIsLoading(false);
          return;
        }

        initializedGameIdRef.current = gameId;
        setCurrentGameId(gameId);
        setRoomId(`creator:${gameId}:map:${encodeURIComponent(game.mapName)}`);
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading creator game:", err);
        setError("Failed to load game");
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [gameId, hasUser, loadGameById, router, setCurrentGameId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading creator…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{error}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Please check if the game exists and you have access to it.
          </p>
        </div>
      </div>
    );
  }

  const user = session?.user
    ? {
        id: session.userId || session.user.email || "",
        email: session.user.email || "",
        name: session.user.name ?? undefined,
        image: session.user.image ?? undefined,
      }
    : null;

  return (
    <CollaborationProvider roomId={roomId} user={user}>
      <CollaborationNotice>
        <App />
      </CollaborationNotice>
    </CollaborationProvider>
  );
}
