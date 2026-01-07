import { create } from "zustand";
import { createProvider as createProviderService } from "../service/create";
import { deleteProvider as deleteProviderService } from "../service/delete";
import { getProviders } from "../service/get";
import { updateProvider as updateProviderService } from "../service/update";
import type { Provider, ProvidersState } from "../types";

export const useProvidersStore = create<ProvidersState>((set, get) => ({
  providers: [],
  loading: false,
  error: null,

  fetchProviders: async () => {
    // Don't refetch if we already have data and it's fresh
    const { providers, loading } = get();
    if (providers.length > 0 || loading) return;

    set({ loading: true, error: null });
    try {
      const providers = await getProviders();
      set({ providers, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch providers",
        loading: false,
      });
    }
  },

  updateProvider: async (slug: string, updates: Partial<Provider>) => {
    const { providers } = get();

    // Optimistic update
    const optimisticProviders = providers.map((p) => (p.slug === slug ? { ...p, ...updates } : p));
    set({ providers: optimisticProviders });

    try {
      await updateProviderService(slug, updates);
      // Fetch fresh data to ensure consistency
      await get().fetchProviders();
    } catch (error) {
      // Revert optimistic update on error
      set({ providers });
      set({ error: error instanceof Error ? error.message : "Failed to update provider" });
      throw error;
    }
  },

  deleteProvider: async (slug: string) => {
    const { providers } = get();

    // Optimistic update
    const optimisticProviders = providers.filter((p) => p.slug !== slug);
    set({ providers: optimisticProviders });

    try {
      await deleteProviderService(slug);
    } catch (error) {
      // Revert optimistic update on error
      set({ providers });
      set({ error: error instanceof Error ? error.message : "Failed to delete provider" });
      throw error;
    }
  },

  createProvider: async (provider: Omit<Provider, "slug">) => {
    try {
      await createProviderService(provider);
      // Fetch fresh data
      await get().fetchProviders();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to create provider" });
      throw error;
    }
  },

  setProviders: (providers: Provider[]) => set({ providers }),
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
}));
