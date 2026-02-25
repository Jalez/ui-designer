import { create } from "zustand";
import { createGame, deleteGame, getGame, loadGames, updateGame } from "../service";
import type { Game, GameState } from "../types";

export const useGameStore = create<GameState>()((set, get) => ({
  games: [],
  currentGameId: null,
  isLoading: false,
  isInitialized: false,
  loadingGameId: null,

  createGame: async (userId: string, mapName: string, title?: string) => {
    const game = await createGame({ mapName, title });
    set((state) => ({
      games: [game, ...state.games],
    }));
    return game;
  },

  updateGame: async (id: string, updates: Partial<Game>) => {
    const updatedGame = await updateGame(id, updates);
    set((state) => ({
      games: state.games.map((g) =>
        g.id === id ? { ...g, ...updatedGame } : g
      ),
    }));
  },

  removeGame: async (id: string) => {
    await deleteGame(id);
    set((state) => ({
      games: state.games.filter((g) => g.id !== id),
      currentGameId: state.currentGameId === id ? null : state.currentGameId,
    }));
  },

  clearGames: () => {
    set({
      games: [],
      currentGameId: null,
      isInitialized: false,
    });
  },

  setCurrentGameId: (id: string) => {
    set({ currentGameId: id });
  },

  updateGameProgress: async (id: string, progressData: Record<string, unknown>) => {
    await get().updateGame(id, { progressData });
  },

  loadGames: async () => {
    set({ isLoading: true });
    try {
      const games = await loadGames();
      set({
        games,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Failed to load games:", error);
      set({ isLoading: false });
      throw error;
    }
  },

  loadGameById: async (id: string) => {
    set({ loadingGameId: id });
    try {
      const game = await getGame(id);
      set((state) => {
        const exists = state.games.some((g) => g.id === id);
        return {
          games: exists
            ? state.games.map((g) => (g.id === id ? game : g))
            : [...state.games, game],
          loadingGameId: null,
        };
      });
      return game;
    } catch (error) {
      console.error("Failed to load game:", error);
      set({ loadingGameId: null });
      return null;
    }
  },

  saveGame: async (game: Game) => {
    await get().updateGame(game.id, game);
  },

  addGameToStore: (game: Game) => {
    set((state) => ({
      games: [game, ...state.games],
    }));
  },

  getGameById: (id: string) => {
    return get().games.find((g) => g.id === id);
  },

  getCurrentGame: () => {
    const { currentGameId, games } = get();
    if (!currentGameId) return null;
    return games.find((g) => g.id === currentGameId) || null;
  },

  getGames: () => {
    return get().games;
  },
}));
