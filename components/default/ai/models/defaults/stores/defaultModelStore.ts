import { useSession } from "next-auth/react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getModels } from "../../service/get";
import type { Model } from "../../types";
import { filterImageModels, filterOcrModels, filterTextModels } from "../../utils/modelFiltering";
import { getUserDefaults, saveUserDefaults } from "../service";

export interface DefaultModels {
  textModel: string;
  imageModel: string;
  imageOCRModel: string;
  pdfOCRModel: string;
}

export interface DefaultModelState extends DefaultModels {
  // User context
  userId: string | null;

  // Available models for selection
  availableTextModels: Model[];
  availableImageModels: Model[];
  availableOCRModels: Model[]; // Now same structure as other models

  // Loading states
  loading: boolean;
  loadingDefaults: boolean;
  syncingDefaults: boolean;
  error: string | null;

  // Actions
  setDefaultTextModel: (modelId: string, userId?: string) => void;
  setDefaultImageModel: (modelId: string, userId?: string) => void;
  setDefaultImageOCRModel: (modelId: string, userId?: string) => void;
  setDefaultPdfOCRModel: (modelId: string, userId?: string) => void;

  // Fetch available models
  fetchAvailableModels: () => Promise<void>;
  fetchAvailableOCRModels: () => Promise<void>;

  // Backend sync
  loadDefaultsFromBackend: (userId: string) => Promise<void>;
  syncDefaultsToBackend: (userId: string) => Promise<void>;

  // Validation
  isValidTextModel: (modelId: string) => boolean;
  isValidImageModel: (modelId: string) => boolean;
  isValidOCRModel: (modelId: string) => boolean;

  // Reset
  resetDefaults: () => void;
}

// Default values - all empty, will be auto-selected from available models
const defaultModels: DefaultModels = {
  textModel: "",
  imageModel: "",
  imageOCRModel: "",
  pdfOCRModel: "",
};

export const useDefaultModelStore = create<DefaultModelState>()(
  persist(
    (set, get) => ({
      // Initial state
      ...defaultModels,
      userId: null,
      availableTextModels: [],
      availableImageModels: [],
      availableOCRModels: [], // Now Model[] like others
      loading: false,
      loadingDefaults: false,
      syncingDefaults: false,
      error: null,

      setDefaultTextModel: (modelId: string, userId?: string) => {
        const update: any = { textModel: modelId };
        if (userId) update.userId = userId;
        set(update);
        // Background sync to backend if userId available
        const currentUserId = userId || get().userId;
        if (currentUserId) {
          get()
            .syncDefaultsToBackend(currentUserId)
            .catch(() => {
              // Silently handle errors - optimistic update
            });
        }
      },

      setDefaultImageModel: (modelId: string, userId?: string) => {
        const update: any = { imageModel: modelId };
        if (userId) update.userId = userId;
        set(update);
        // Background sync to backend if userId available
        const currentUserId = userId || get().userId;
        if (currentUserId) {
          get()
            .syncDefaultsToBackend(currentUserId)
            .catch(() => {
              // Silently handle errors - optimistic update
            });
        }
      },

      setDefaultImageOCRModel: (modelId: string, userId?: string) => {
        const update: any = { imageOCRModel: modelId };
        if (userId) update.userId = userId;
        set(update);
        // Background sync to backend if userId available
        const currentUserId = userId || get().userId;
        if (currentUserId) {
          get()
            .syncDefaultsToBackend(currentUserId)
            .catch(() => {
              // Silently handle errors - optimistic update
            });
        }
      },

      setDefaultPdfOCRModel: (modelId: string, userId?: string) => {
        const update: any = { pdfOCRModel: modelId };
        if (userId) update.userId = userId;
        set(update);
        // Background sync to backend if userId available
        const currentUserId = userId || get().userId;
        if (currentUserId) {
          get()
            .syncDefaultsToBackend(currentUserId)
            .catch(() => {
              // Silently handle errors - optimistic update
            });
        }
      },

      fetchAvailableModels: async () => {
        const state = get();
        if (state.loading) return;

        set({ loading: true, error: null });

        try {
          const allModels = await getModels();

          // Separate local and regular models
          const localModels = allModels.filter((m) => m.id.startsWith("ollama/"));
          const regularModels = allModels.filter((m) => !m.id.startsWith("ollama/"));

          // Use shared filtering logic
          const textModels = [...filterTextModels(regularModels), ...filterTextModels(localModels)];

          const imageModels = [...filterImageModels(regularModels), ...filterImageModels(localModels)];

          set({
            availableTextModels: textModels,
            availableImageModels: imageModels,
            loading: false,
          });

          // Auto-set default models if none are set
          const currentState = get();
          if (!currentState.textModel && textModels.length > 0) {
            const firstTextModel = textModels.find((m) => {
              const modality = m.architecture.modality;
              if (typeof modality === "string") {
                return modality === "text->text" || modality === "text+image->text" || modality.includes("text->text");
              }
              if (Array.isArray(modality)) {
                return (
                  (modality as string[]).includes("text->text") || (modality as string[]).includes("text+image->text")
                );
              }
              return false;
            });
            if (firstTextModel) {
              set({ textModel: firstTextModel.id });
            }
          }

          if (!currentState.imageModel && imageModels.length > 0) {
            const firstImageModel = imageModels.find((m) => {
              const modality = m.architecture.modality;
              if (typeof modality === "string") {
                return modality.includes("->image") || modality.includes("->text+image");
              }
              if (Array.isArray(modality)) {
                return (modality as string[]).some(
                  (mod: string) => mod.includes("->image") || mod.includes("->text+image"),
                );
              }
              return false;
            });
            if (firstImageModel) {
              set({ imageModel: firstImageModel.id });
            }
          }

          // Validate and reset invalid default models
          if (currentState.textModel && textModels.length > 0) {
            const currentModel = textModels.find((m) => m.id === currentState.textModel);
            const shouldReset =
              !currentModel ||
              (() => {
                const modality = currentModel.architecture?.modality;
                if (typeof modality === "string") {
                  return modality.includes("->image") && !modality.includes("text+image->text");
                }
                if (Array.isArray(modality)) {
                  return (
                    (modality as any).some((mod: string) => mod.includes("->image")) &&
                    !(modality as any).some((mod: string) => mod.includes("text+image->text"))
                  );
                }
                return false;
              })();

            if (shouldReset) {
              const firstTextModel = textModels.find((m) => {
                const modality = m.architecture.modality;
                if (typeof modality === "string") {
                  return (
                    modality === "text->text" || modality === "text+image->text" || modality.includes("text->text")
                  );
                }
                if (Array.isArray(modality)) {
                  return (
                    (modality as string[]).includes("text->text") || (modality as string[]).includes("text+image->text")
                  );
                }
                return false;
              });
              if (firstTextModel) {
                set({ textModel: firstTextModel.id });
              }
            }
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : "Failed to fetch models",
            loading: false,
          });
        }
      },

      fetchAvailableOCRModels: async () => {
        const state = get();
        if (state.loading) return;

        // If we already have models loaded, filter OCR models from them
        if (state.availableTextModels.length > 0 || state.availableImageModels.length > 0) {
          const allModels = [...state.availableTextModels, ...state.availableImageModels];
          const ocrModels = filterOcrModels(allModels);
          set({ availableOCRModels: ocrModels });
          return;
        }

        // Otherwise, fetch from main models endpoint and filter
        try {
          const allModels = await getModels();
          const ocrModels = filterOcrModels(allModels);
          set({ availableOCRModels: ocrModels });
        } catch (error) {
          console.warn("OCR models not available:", error);
          // No fallback models - show empty list if API fails
          set({ availableOCRModels: [] });
        }
      },

      loadDefaultsFromBackend: async (userId: string) => {
        const state = get();

        // Only call backend if store is empty (no default models set)
        const hasDefaults = state.textModel || state.imageModel || state.imageOCRModel || state.pdfOCRModel;
        if (hasDefaults) {
          return; // Skip backend call to save network requests
        }

        // Prevent duplicate concurrent loads
        if (state.loadingDefaults) {
          return;
        }

        set({ loadingDefaults: true });

        try {
          const backendDefaults = await getUserDefaults(userId);

          // Only update if we have actual backend data (not all null)
          const hasBackendData =
            backendDefaults.textModel ||
            backendDefaults.imageModel ||
            backendDefaults.imageOCRModel ||
            backendDefaults.pdfOCRModel;

          if (hasBackendData) {
            set({
              textModel: backendDefaults.textModel || "",
              imageModel: backendDefaults.imageModel || "",
              imageOCRModel: backendDefaults.imageOCRModel || "",
              pdfOCRModel: backendDefaults.pdfOCRModel || "",
            });
          }
          // If no backend data, keep current empty state (will trigger auto-selection)

          set({ loadingDefaults: false });
        } catch (error) {
          console.warn("Failed to load defaults from backend:", error);
          // Silently fail - keep local state
          set({ loadingDefaults: false });
        }
      },

      syncDefaultsToBackend: async (userId: string) => {
        const state = get();

        // Prevent duplicate concurrent syncs
        if (state.syncingDefaults) {
          return;
        }

        set({ syncingDefaults: true });

        try {
          await saveUserDefaults(userId, {
            textModel: state.textModel || null,
            imageModel: state.imageModel || null,
            imageOCRModel: state.imageOCRModel || null,
            pdfOCRModel: state.pdfOCRModel || null,
          });
        } catch (error) {
          console.warn("Failed to sync defaults to backend:", error);
          // Don't show error to user - backend sync is background operation
        } finally {
          set({ syncingDefaults: false });
        }
      },

      isValidTextModel: (modelId: string) => {
        const { availableTextModels } = get();
        return availableTextModels.some((model) => model.id === modelId);
      },

      isValidImageModel: (modelId: string) => {
        const { availableImageModels } = get();
        return availableImageModels.some((model) => model.id === modelId);
      },

      isValidOCRModel: (modelId: string) => {
        const { availableOCRModels } = get();
        return availableOCRModels.some((model) => model.id === modelId);
      },

      resetDefaults: () => {
        set(defaultModels);
      },
    }),
    {
      name: "default-models",
      version: 1,
      // Only persist the model IDs, not the available models or loading states
      partialize: (state) => ({
        textModel: state.textModel,
        imageModel: state.imageModel,
        imageOCRModel: state.imageOCRModel,
        pdfOCRModel: state.pdfOCRModel,
      }),
    },
  ),
);
