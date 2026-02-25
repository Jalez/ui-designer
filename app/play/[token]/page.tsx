'use client';

import { use, useEffect, useState } from "react";
import App from "@/components/App";
import { useGameStore } from "@/components/default/games";
import { useSidebarCollapse } from "@/components/default/sidebar/context/SidebarCollapseContext";

interface PlayPageProps {
  params: Promise<{ token: string }>;
}

function PlayPageInner({ gameId, hideSidebar }: { gameId: string; hideSidebar: boolean }) {
  const { setIsVisible } = useSidebarCollapse();

  useEffect(() => {
    if (hideSidebar) {
      setIsVisible(false);
    }
    return () => {
      setIsVisible(true);
    };
  }, [hideSidebar, setIsVisible]);

  const { setCurrentGameId } = useGameStore();
  useEffect(() => {
    setCurrentGameId(gameId);
  }, [gameId, setCurrentGameId]);

  return <App />;
}

export default function PlayPage({ params }: PlayPageProps) {
  const { token } = use(params);
  const { addGameToStore, getGameById } = useGameStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [hideSidebar, setHideSidebar] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/games/play/${token}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Game not found");
          return;
        }
        const game = await res.json();

        if (!getGameById(game.id)) {
          addGameToStore({
            id: game.id,
            userId: "",
            mapName: game.mapName,
            title: game.title,
            progressData: game.progressData ?? {},
            isPublic: true,
            shareToken: game.shareToken,
            thumbnailUrl: game.thumbnailUrl ?? null,
            hideSidebar: game.hideSidebar ?? false,
            createdAt: game.createdAt,
            updatedAt: game.updatedAt,
          });
        }

        setHideSidebar(game.hideSidebar ?? false);
        setGameId(game.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load game";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [token, addGameToStore, getGameById]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading game…</p>
        </div>
      </div>
    );
  }

  if (error || !gameId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">{error ?? "Game not found"}</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            This game may be private or the link may have expired.
          </p>
        </div>
      </div>
    );
  }

  return <PlayPageInner gameId={gameId} hideSidebar={hideSidebar} />;
}
