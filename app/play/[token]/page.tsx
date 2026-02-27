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
  const [requiresAccessKey, setRequiresAccessKey] = useState(false);
  const [accessKey, setAccessKey] = useState("");
  const [accessKeyError, setAccessKeyError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const query = accessKey ? `?key=${encodeURIComponent(accessKey)}` : "";
        const res = await fetch(`/api/games/play/${token}${query}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          if (res.status === 403 && data.requiresAccessKey) {
            setRequiresAccessKey(true);
            setAccessKeyError(data.error || "Access key required");
            setIsLoading(false);
            return;
          }
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
            accessWindowEnabled: game.accessWindowEnabled ?? false,
            accessStartsAt: game.accessStartsAt ?? null,
            accessEndsAt: game.accessEndsAt ?? null,
            accessKeyRequired: game.accessKeyRequired ?? false,
            collaborationMode: game.collaborationMode ?? "individual",
            createdAt: game.createdAt,
            updatedAt: game.updatedAt,
          });
        }

        setHideSidebar(game.hideSidebar ?? false);
        setRequiresAccessKey(false);
        setAccessKeyError(null);
        setGameId(game.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load game";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [token, accessKey, loadAttempt, addGameToStore, getGameById]);

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
    if (requiresAccessKey) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="w-full max-w-sm rounded border p-6 space-y-3">
            <h2 className="text-xl font-semibold">Access Key Required</h2>
            <p className="text-sm text-muted-foreground">
              This game requires a special key. Ask the creator for the current key.
            </p>
            <input
              type="password"
              className="w-full rounded border px-3 py-2 text-sm"
              value={accessKey}
              onChange={(event) => setAccessKey(event.target.value)}
              placeholder="Enter access key"
            />
            {accessKeyError && <p className="text-sm text-red-600">{accessKeyError}</p>}
            <button
              className="w-full rounded bg-primary text-primary-foreground px-3 py-2 text-sm"
              onClick={() => {
                setIsLoading(true);
                setError(null);
                setLoadAttempt((value) => value + 1);
              }}
            >
              Continue
            </button>
          </div>
        </div>
      );
    }

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
