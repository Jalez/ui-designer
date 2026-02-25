export interface Game {
  id: string;
  userId: string;
  mapName: string;
  title: string;
  progressData: Record<string, unknown>;
  isPublic: boolean;
  shareToken: string | null;
  thumbnailUrl: string | null;
  hideSidebar: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GameState {
  games: Game[];
  currentGameId: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  loadingGameId: string | null;

  createGame: (userId: string, mapName: string, title?: string) => Promise<Game>;
  updateGame: (id: string, updates: Partial<Game>) => Promise<void>;
  removeGame: (id: string) => Promise<void>;
  clearGames: () => void;

  setCurrentGameId: (id: string) => void;
  updateGameProgress: (id: string, progressData: Record<string, unknown>) => Promise<void>;

  loadGames: () => Promise<void>;
  loadGameById: (id: string) => Promise<Game | null>;
  saveGame: (game: Game) => Promise<void>;
  addGameToStore: (game: Game) => void;

  getGameById: (id: string) => Game | undefined;
  getCurrentGame: () => Game | null;
  getGames: () => Game[];
}
