import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserSettingsState } from "../types";
import { defaultUserSettings } from "../types";

export const useUserSettingsStore = create<UserSettingsState>()(
  persist(
    (set, _get) => ({
      ...defaultUserSettings,

      setAutoRetryOnFailure: (enabled: boolean) => {
        set({ autoRetryOnFailure: enabled });
      },

      setShowOCRMethodIndicator: (show: boolean) => {
        set({ showOCRMethodIndicator: show });
      },

      setDefaultTextModel: (modelId: string) => {
        set({ defaultTextModel: modelId });
      },

      setDefaultImageModel: (modelId: string) => {
        set({ defaultImageModel: modelId });
      },

      setDefaultImageOCRModel: (modelId: string) => {
        set({ defaultImageOCRModel: modelId });
      },

      setDefaultPdfOCRModel: (modelId: string) => {
        set({ defaultPdfOCRModel: modelId });
      },

      resetSettings: () => {
        set(defaultUserSettings);
      },
    }),
    {
      name: "user-settings",
      version: 2, // Increment version to trigger migration
    },
  ),
);
