'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Map as MapIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PoppingTitle from "../General/PoppingTitle";
import MapLevels from "./MapEditor/MapLevels";
import { addLevelsToMap, getMapLevels } from "@/lib/utils/network/maps";
import { cloneLevel } from "@/lib/utils/network/levels";
import { loadGames } from "@/components/default/games/service";
import { useGameStore } from "@/components/default/games";
import { useAppDispatch, useAppSelector } from "@/store/hooks/hooks";
import { setCurrentLevel } from "@/store/slices/currentLevel.slice";
import { updateWeek, setAllLevels } from "@/store/slices/levels.slice";
import { resetDrawingUrls } from "@/store/slices/drawingUrls.slice";
import { initializePointsFromLevelsStateThunk } from "@/store/actions/score.actions";
import { toast } from "sonner";

export interface MapEditorRef {
  triggerOpen: () => void;
}

interface MapEditorProps {
  renderButton?: boolean;
}

interface ImportCandidate {
  identifier: string;
  name: string;
  mapName: string;
  sourceGameTitle: string;
}

const MapEditor = forwardRef<MapEditorRef, MapEditorProps>(({ renderButton = true }, ref) => {
  const [open, setOpen] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedImportId, setSelectedImportId] = useState("");

  const dispatch = useAppDispatch();
  const options = useAppSelector((state) => state.options);
  const levels = useAppSelector((state) => state.levels);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const getCurrentGame = useGameStore((state) => state.getCurrentGame);
  const currentGame = getCurrentGame();
  const isCreator = options.mode === "creator";

  const handleOpen = useCallback(() => setOpen(true), []);

  useImperativeHandle(
    ref,
    () => ({
      triggerOpen: handleOpen,
    }),
    [handleOpen],
  );

  const refreshCurrentMapLevels = useCallback(async () => {
    if (!currentGame?.id || !currentGame.mapName) return;

    const freshLevels = await getMapLevels(currentGame.mapName, { forceFresh: true });

    dispatch(
      updateWeek({
        levels: freshLevels,
        mapName: currentGame.mapName,
        gameId: currentGame.id,
        mode: options.mode,
        forceFresh: true,
      }),
    );
    dispatch(resetDrawingUrls());
    setAllLevels(freshLevels);
    dispatch(initializePointsFromLevelsStateThunk());

    if (currentLevel > freshLevels.length) {
      dispatch(setCurrentLevel(Math.max(1, freshLevels.length)));
    }
  }, [currentGame?.id, currentGame?.mapName, currentLevel, dispatch, options.mode]);

  useEffect(() => {
    if (!open || !currentGame?.mapName || !isCreator) return;

    let mounted = true;
    const loadCandidates = async () => {
      try {
        setIsLoadingCandidates(true);
        const games = await loadGames();
        const editableGames = games.filter((game) => Boolean(game.canEdit || game.isOwner));
        const mapToGameTitle = new globalThis.Map<string, string>();
        for (const game of editableGames) {
          if (!mapToGameTitle.has(game.mapName)) {
            mapToGameTitle.set(game.mapName, game.title || game.mapName);
          }
        }
        const mapNames = Array.from(mapToGameTitle.keys());
        const existingIdentifiers = new Set(levels.map((level) => level.identifier).filter(Boolean));
        const dedup = new globalThis.Map<string, ImportCandidate>();

        await Promise.all(
          mapNames.map(async (mapName) => {
            const mapLevels = await getMapLevels(mapName);
            for (const level of mapLevels) {
              if (!level.identifier || existingIdentifiers.has(level.identifier)) continue;
              if (!dedup.has(level.identifier)) {
                dedup.set(level.identifier, {
                  identifier: level.identifier,
                  name: level.name,
                  mapName,
                  sourceGameTitle: mapToGameTitle.get(mapName) || mapName,
                });
              }
            }
          }),
        );

        if (!mounted) return;
        const sorted = Array.from(dedup.values()).sort((a, b) => a.name.localeCompare(b.name));
        setImportCandidates(sorted);
      } catch (error) {
        console.error("Failed to load import candidates", error);
        if (mounted) {
          toast.error("Failed to load level import list");
        }
      } finally {
        if (mounted) {
          setIsLoadingCandidates(false);
        }
      }
    };

    loadCandidates();

    return () => {
      mounted = false;
    };
  }, [currentGame?.mapName, dispatch, isCreator, levels, open]);

  const filteredCandidates = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return importCandidates;
    return importCandidates.filter(
      (candidate) =>
        candidate.name.toLowerCase().includes(term) ||
        candidate.sourceGameTitle.toLowerCase().includes(term) ||
        candidate.mapName.toLowerCase().includes(term),
    );
  }, [importCandidates, search]);

  const selectedCandidate =
    filteredCandidates.find((candidate) => candidate.identifier === selectedImportId) || null;

  const handleCreateCopy = useCallback(async () => {
    if (!selectedCandidate || !currentGame?.mapName) return;
    try {
      setIsApplyingImport(true);
      const copied = await cloneLevel(selectedCandidate.identifier, `${selectedCandidate.name} (Copy)`);
      if (!copied.identifier) {
        throw new Error("Clone response missing identifier");
      }
      await addLevelsToMap(currentGame.mapName, [copied.identifier]);
      await refreshCurrentMapLevels();
      setSelectedImportId("");
      toast.success("Copied level added to game");
    } catch (error) {
      console.error(error);
      toast.error("Failed to copy level");
    } finally {
      setIsApplyingImport(false);
    }
  }, [selectedCandidate, currentGame?.mapName, refreshCurrentMapLevels]);

  const getThumbnailForLevel = useCallback(
    () => null,
    [],
  );

  const handleSelectLevel = useCallback(
    (index: number) => {
      dispatch(setCurrentLevel(index + 1));
      setOpen(false);
    },
    [dispatch],
  );

  if (!isCreator) return null;

  return (
    <>
      {renderButton && (
        <PoppingTitle topTitle="Game Levels">
          <Button type="button" variant="ghost" size="icon" onClick={handleOpen}>
            <MapIcon className="h-5 w-5" />
          </Button>
        </PoppingTitle>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Game Levels</DialogTitle>
            <DialogDescription>
              Levels imported from other games are always added as independent copies.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <MapLevels
              levels={levels}
              getThumbnailForLevel={getThumbnailForLevel}
              onSelectLevel={handleSelectLevel}
            />

            <div className="space-y-3 rounded-md border p-3">
              <h3 className="text-sm font-semibold">Import Level Copy</h3>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by level, game, or map"
                  className="pl-8"
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 rounded border p-1">
                {isLoadingCandidates && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">Loading levels…</p>
                )}
                {!isLoadingCandidates && filteredCandidates.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No levels found.</p>
                )}
                {filteredCandidates.map((candidate) => (
                  <Button
                    type="button"
                    key={candidate.identifier}
                    variant={selectedImportId === candidate.identifier ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start px-2 py-1.5 text-left"
                    onClick={() => setSelectedImportId(candidate.identifier)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{candidate.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {candidate.sourceGameTitle} · {candidate.mapName}
                      </p>
                    </div>
                  </Button>
                ))}
              </div>

              <Button
                type="button"
                className="w-full"
                disabled={!selectedCandidate || isApplyingImport}
                onClick={handleCreateCopy}
              >
                Add as independent copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

MapEditor.displayName = "MapEditor";

export default MapEditor;
