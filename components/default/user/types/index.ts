/**
 * User Module Types
 *
 * Types for user settings and preferences
 */

import type { OCRMethod } from "../../../scriba/ocr/types";

export type { OCRMethod };

export interface UserSettings {
  preferredOCRMethod: OCRMethod;
  autoRetryOnFailure: boolean;
  showOCRMethodIndicator: boolean;
  defaultTextModel?: string;
  defaultImageModel?: string;
  defaultImageOCRModel?: string;
  defaultPdfOCRModel?: string;
}

export interface UserSettingsState extends UserSettings {
  // Actions
  setPreferredOCRMethod: (method: OCRMethod) => void;
  setAutoRetryOnFailure: (enabled: boolean) => void;
  setShowOCRMethodIndicator: (show: boolean) => void;
  setDefaultTextModel: (modelId: string) => void;
  setDefaultImageModel: (modelId: string) => void;
  setDefaultImageOCRModel: (modelId: string) => void;
  setDefaultPdfOCRModel: (modelId: string) => void;
  resetSettings: () => void;
}

export const defaultUserSettings: UserSettings = {
  preferredOCRMethod: "google-vision", // Default to Google Vision for better accuracy
  autoRetryOnFailure: true, // Enable auto-retry to fall back to Tesseract when Google Vision fails
  showOCRMethodIndicator: true, // Show which method was used
  defaultTextModel: undefined,
  defaultImageModel: undefined,
  defaultImageOCRModel: "google-vision",
  defaultPdfOCRModel: "google-vision",
};
