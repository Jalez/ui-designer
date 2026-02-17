import { create } from "zustand";

type InstanceModelType = "textModel" | "imageModel" | "imageOCRModel" | "pdfOCRModel";

interface InstanceModelMap {
  textModel?: string;
  imageModel?: string;
  imageOCRModel?: string;
  pdfOCRModel?: string;
}

interface DocumentModelEntry {
  models: InstanceModelMap;
  updatedAt: number;
}

export interface InstanceModelState {
  overrides: Record<string, DocumentModelEntry>;
  setInstanceModel: (documentId: string, type: InstanceModelType, modelId: string | null) => void;
  clearDocumentModels: (documentId: string) => void;
}

const MAX_DOCUMENT_OVERRIDES = 10;

function pruneOverrides(overrides: Record<string, DocumentModelEntry>): Record<string, DocumentModelEntry> {
  const entries = Object.entries(overrides);

  if (entries.length <= MAX_DOCUMENT_OVERRIDES) {
    return overrides;
  }

  const sorted = entries.sort(([, a], [, b]) => b.updatedAt - a.updatedAt).slice(0, MAX_DOCUMENT_OVERRIDES);
  return Object.fromEntries(sorted);
}

export const useInstanceModelStore = create<InstanceModelState>()(
  (set) => ({
      overrides: {},
      setInstanceModel: (documentId, type, modelId) => {
        if (!documentId) {
          return;
        }

        set((state) => {
          const existingEntry = state.overrides[documentId] || { models: {}, updatedAt: Date.now() };
          const nextModels = { ...existingEntry.models };

          if (modelId) {
            nextModels[type] = modelId;
          } else {
            delete nextModels[type];
          }

          const hasOverrides = Object.keys(nextModels).length > 0;
          let nextOverrides = { ...state.overrides };

          if (hasOverrides) {
            nextOverrides[documentId] = {
              models: nextModels,
              updatedAt: Date.now(),
            };
          } else {
            delete nextOverrides[documentId];
          }

          nextOverrides = pruneOverrides(nextOverrides);

          return { overrides: nextOverrides };
        });
      },
      clearDocumentModels: (documentId) => {
        if (!documentId) {
          return;
        }
        set((state) => {
          if (!state.overrides[documentId]) {
            return state;
          }
          const nextOverrides = { ...state.overrides };
          delete nextOverrides[documentId];
          return { overrides: nextOverrides };
        });
      },
    }),
);



