/**
 * User Module Types
 *
 * Types for user settings and preferences
 */

export interface UserSettings {
  autoRetryOnFailure: boolean;
  showOCRMethodIndicator: boolean;
  defaultTextModel?: string;
  defaultImageModel?: string;
  defaultImageOCRModel?: string;
  defaultPdfOCRModel?: string;
}

export interface UserSettingsState extends UserSettings {
  // Actions
  setAutoRetryOnFailure: (enabled: boolean) => void;
  setShowOCRMethodIndicator: (show: boolean) => void;
  setDefaultTextModel: (modelId: string) => void;
  setDefaultImageModel: (modelId: string) => void;
  setDefaultImageOCRModel: (modelId: string) => void;
  setDefaultPdfOCRModel: (modelId: string) => void;
  resetSettings: () => void;
}

export const defaultUserSettings: UserSettings = {
  autoRetryOnFailure: true,
  showOCRMethodIndicator: true, // Show which method was used
  defaultTextModel: undefined,
  defaultImageModel: undefined,
  defaultImageOCRModel: "google-vision",
  defaultPdfOCRModel: "google-vision",
};
