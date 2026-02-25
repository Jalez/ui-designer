'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Loader2 } from "lucide-react";

interface PublicGame {
  id: string;
  mapName: string;
  title: string;
  thumbnailUrl: string | null;
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function GamesPage() {
  const [games, setGames] = useState<PublicGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch("/api/games");
        if (!res.ok) throw new Error("Failed to fetch games");
        const data = await res.json();
        setGames(data);
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, []);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Globe className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Public Games</h1>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <p className="text-center text-destructive py-10">{error}</p>
      )}

      {!isLoading && !error && games.length === 0 && (
        <p className="text-center text-muted-foreground py-10">
          No public games yet. Create a game and set it to public!
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {games.map((game) => {
          const href = game.shareToken ? `/play/${game.shareToken}` : `/project/${game.id}`;
          return (
            <Link
              key={game.id}
              href={href}
              className="group rounded-xl border bg-card hover:shadow-md transition overflow-hidden"
            >
              <div className="h-36 bg-muted flex items-center justify-center overflow-hidden">
                {game.thumbnailUrl ? (
                  <img
                    src={game.thumbnailUrl}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Globe className="h-10 w-10 text-muted-foreground/30" />
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold truncate">{game.title || "Untitled Game"}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{game.mapName}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
