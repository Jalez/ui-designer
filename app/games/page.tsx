'use client';

import { useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import Link from "next/link";
import { CheckSquare, Globe, KeyRound, Layers3, Loader2, Skull, Trash2, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeaderboardDialog } from "@/components/GameStatistics/LeaderboardDialog";
import { Checkbox } from "@/components/tailwind/ui/checkbox";
import { checkAdminStatus } from "@/components/default/user/utils/admin";
import { Input } from "@/components/ui/input";

interface PublicGame {
  id: string;
  mapName: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  shareToken: string | null;
  accessKeyRequired: boolean;
  createdAt: string;
  updatedAt: string;
  languages: {
    html: boolean;
    css: boolean;
    js: boolean;
  };
  levelsCount: number;
  difficulties: string[];
}

export default function GamesPage() {
  const [games, setGames] = useState<PublicGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch(apiUrl("/api/games/public"));
        if (!res.ok) throw new Error("Failed to fetch games");
        const data = await res.json();
        setGames(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    };
    fetchGames();
  }, []);

  useEffect(() => {
    const loadAdminStatus = async () => {
      const admin = await checkAdminStatus();
      setIsAdmin(admin);
    };
    void loadAdminStatus();
  }, []);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredGames = useMemo(() => {
    if (!normalizedSearch) {
      return games;
    }

    return games.filter((game) => {
      const title = game.title?.toLowerCase() ?? "";
      const description = game.description?.toLowerCase() ?? "";
      const mapName = game.mapName?.toLowerCase() ?? "";
      return title.includes(normalizedSearch) || description.includes(normalizedSearch) || mapName.includes(normalizedSearch);
    });
  }, [games, normalizedSearch]);

  const protectedGames = filteredGames.filter((game) => game.accessKeyRequired);
  const openGames = filteredGames.filter((game) => !game.accessKeyRequired);
  const selectedCount = selectedGameIds.length;
  const allVisibleSelected = useMemo(
    () => filteredGames.length > 0 && filteredGames.every((game) => selectedGameIds.includes(game.id)),
    [filteredGames, selectedGameIds],
  );

  const toggleSelected = (gameId: string, checked: boolean) => {
    setSelectedGameIds((prev) => {
      if (checked) {
        return prev.includes(gameId) ? prev : [...prev, gameId];
      }
      return prev.filter((id) => id !== gameId);
    });
  };

  const toggleSelectAll = () => {
    setSelectedGameIds((prev) => {
      const visibleIds = filteredGames.map((game) => game.id);
      if (visibleIds.length === 0) {
        return prev;
      }

      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const deleteSelectedGames = async () => {
    if (selectedGameIds.length === 0 || isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedGameIds.length} selected game${selectedGameIds.length === 1 ? "" : "s"}? This also removes their saved instances, results, and unused map/level data.`,
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        selectedGameIds.map(async (gameId) => {
          const response = await fetch(apiUrl(`/api/games/${gameId}`), {
            method: "DELETE",
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || payload?.message || `Failed to delete game ${gameId}`);
          }
          return gameId;
        }),
      );

      const deletedIds = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map((result) => result.value);

      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) => result.reason instanceof Error ? result.reason.message : "Failed to delete one or more games");

      if (deletedIds.length > 0) {
        setGames((prev) => prev.filter((game) => !deletedIds.includes(game.id)));
        setSelectedGameIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
      }

      if (failures.length > 0) {
        setError(failures[0]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete selected games");
    } finally {
      setIsDeleting(false);
    }
  };

  const renderGamesGrid = (items: PublicGame[]) => (
    <div className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((game) => {
        const href = `/game/${game.id}`;
        const description = game.description?.trim() || "No description yet.";
        const languageBadges = [
          game.languages.html ? "HTML" : null,
          game.languages.css ? "CSS" : null,
          game.languages.js ? "JS" : null,
        ].filter(Boolean) as string[];

        return (
          <div
            key={game.id}
            className="group relative w-full max-w-[300px] rounded-xl border bg-card hover:shadow-md transition overflow-hidden"
          >
            {isAdmin && (
              <div
                className={`absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-md border bg-background/95 shadow-sm transition-opacity ${
                  selectedGameIds.includes(game.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                <Checkbox
                  checked={selectedGameIds.includes(game.id)}
                  onCheckedChange={(checked) => toggleSelected(game.id, checked === true)}
                  aria-label={`Select ${game.title || "Untitled Game"}`}
                />
              </div>
            )}
            <Link href={href} className="block">
              <div className="relative aspect-square w-full max-w-[300px] bg-muted flex items-center justify-center overflow-hidden">
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
            </Link>
            <div className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-semibold">{game.title || "Untitled Game"}</p>
                {languageBadges.length > 0 && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {languageBadges.map((label) => (
                      <Badge
                        key={label}
                        variant="secondary"
                        className="text-[10px] font-semibold tracking-[0.18em] uppercase"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-1 min-h-8 line-clamp-2 text-xs text-muted-foreground">{description}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                  <Layers3 className="h-3.5 w-3.5" />
                  <span>
                    {game.levelsCount} level{game.levelsCount === 1 ? "" : "s"}
                  </span>
                </div>
                {game.difficulties.length > 0 && (
                  <div className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                    <Skull className="h-3.5 w-3.5" />
                    <span>{game.difficulties.join(" · ")}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" className="h-8 flex-1">
                  <Link href={href}>Play</Link>
                </Button>
                <LeaderboardDialog
                  gameId={game.id}
                  gameTitle={game.title}
                  trigger={({ openDialog }) => (
                    <Button type="button" size="sm" variant="outline" className="h-8 flex-1" onClick={openDialog}>
                      Leaderboard
                    </Button>
                  )}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Globe className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Public Games</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search games..."
              className="h-9 w-[220px]"
              aria-label="Search games"
            />
            {isAdmin && (
              <Button type="button" variant="outline" size="sm" onClick={toggleSelectAll} disabled={games.length === 0}>
                <CheckSquare className="mr-2 h-4 w-4" />
                {allVisibleSelected ? "Clear all" : "Select all"}
              </Button>
            )}
            {isAdmin && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={selectedCount === 0 || isDeleting}
                onClick={deleteSelectedGames}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete selected
              </Button>
            )}
          </div>
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

        {!isLoading && !error && games.length > 0 && filteredGames.length === 0 && (
          <p className="text-center text-muted-foreground py-10">
            No games matched your search.
          </p>
        )}

        {!isLoading && !error && filteredGames.length > 0 && (
          <div className="space-y-10 pb-10">
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Unlock className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Open Access</h2>
                <Badge variant="secondary">{openGames.length}</Badge>
              </div>
              {openGames.length > 0 ? (
                renderGamesGrid(openGames)
              ) : (
                <p className="text-sm text-muted-foreground">No open-access games.</p>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Access Key Required</h2>
                <Badge variant="secondary">{protectedGames.length}</Badge>
              </div>
              {protectedGames.length > 0 ? (
                renderGamesGrid(protectedGames)
              ) : (
                <p className="text-sm text-muted-foreground">No key-protected games.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
