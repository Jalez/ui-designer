import { create } from "zustand";
import { createModel as createModelService } from "../service/create";
import { deleteModel as deleteModelService } from "../service/delete";
import { getModels } from "../service/get";
import { updateModel as updateModelService } from "../service/update";
import type { Model, ModelsState } from "../types";

export const useModelsStore = create<ModelsState>((set, get) => ({
  models: [],
  loading: false,
  error: null,

  fetchModels: async (options = { force: false }) => {
    const { models, loading } = get();
    if (!options.force && (models.length > 0 || loading)) return;

    set({ loading: true, error: null });
    try {
      const models = await getModels();
      set({ models, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to fetch models",
        loading: false,
      });
    }
  },

  updateModel: async (id: string, updates: Partial<Model>) => {
    const { models } = get();

    // Optimistic update
    const optimisticModels = models.map((m) => (m.id === id ? { ...m, ...updates } : m));
    set({ models: optimisticModels });

    try {
      await updateModelService(id, updates);
      // Fetch fresh data to ensure consistency
      await get().fetchModels({ force: true });
    } catch (error) {
      // Revert optimistic update on error
      set({ models });
      set({ error: error instanceof Error ? error.message : "Failed to update model" });
      throw error;
    }
  },

  deleteModel: async (id: string) => {
    const { models } = get();

    // Optimistic update
    const optimisticModels = models.filter((m) => m.id !== id);
    set({ models: optimisticModels });

    try {
      await deleteModelService(id);
    } catch (error) {
      // Revert optimistic update on error
      set({ models });
      set({ error: error instanceof Error ? error.message : "Failed to delete model" });
      throw error;
    }
  },

  createModel: async (model: Model) => {
    try {
      await createModelService(model);
      // Fetch fresh data
      await get().fetchModels({ force: true });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Failed to create model" });
      throw error;
    }
  },

  setModels: (models: Model[]) => set({ models }),
  setLoading: (loading: boolean) => set({ loading }),
  setError: (error: string | null) => set({ error }),
}));
