import { create } from "zustand";

interface StorageStatisticsState {
  // State
  totalStorageBytes: number;
  storageLimitBytes: number;
  isLoading: boolean;
  lastUpdated: Date | null;

  // Actions
  fetchStorageStatistics: (userId: string) => Promise<void>;
  setStorageStatistics: (bytes: number, limit: number) => void;
  updateStorageAfterDeletion: (deletedBytes: number) => void;
  refreshStorage: (userId: string) => Promise<void>;
  reset: () => void;
}

const initialState = {
  totalStorageBytes: 0,
  storageLimitBytes: 0,
  isLoading: false,
  lastUpdated: null,
};

export const useStorageStatisticsStore = create<StorageStatisticsState>((set, get) => ({
  ...initialState,

  fetchStorageStatistics: async (userId: string) => {
    if (get().isLoading) return; // Prevent concurrent fetches

    set({ isLoading: true });
    try {
      const response = await fetch(`/api/statistics/${userId}/read?days=30`);
      if (response.ok) {
        const data = await response.json();
        set({
          totalStorageBytes: data.totalStorageBytes || 0,
          storageLimitBytes: data.storageLimitBytes || 0,
          lastUpdated: new Date(),
          isLoading: false,
        });
      } else {
        console.error("Failed to fetch storage statistics");
        set({ isLoading: false });
      }
    } catch (error) {
      console.error("Error fetching storage statistics:", error);
      set({ isLoading: false });
    }
  },

  setStorageStatistics: (bytes: number, limit: number) => {
    set({
      totalStorageBytes: bytes,
      storageLimitBytes: limit,
      lastUpdated: new Date(),
    });
  },

  updateStorageAfterDeletion: (deletedBytes: number) => {
    set((state) => ({
      totalStorageBytes: Math.max(0, state.totalStorageBytes - deletedBytes),
      lastUpdated: new Date(),
    }));
  },

  refreshStorage: async (userId: string) => {
    await get().fetchStorageStatistics(userId);
  },

  reset: () => {
    set(initialState);
  },
}));

