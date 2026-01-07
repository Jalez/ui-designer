import type { Model } from "../types";

/**
 * Fetch all models from the API
 */
export async function getModels(): Promise<Model[]> {
  const response = await fetch("/api/ai/models/read");

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.models;
}

/**
 * Fetch a single model by ID
 */
export async function getModelById(id: string): Promise<Model | null> {
  const response = await fetch(`/api/ai/models/${encodeURIComponent(id)}/read`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch model: ${response.statusText}`);
  }

  const data = await response.json();
  return data.model || null;
}

/**
 * Update models from OpenRouter API
 */
export async function updateModelsFromOpenRouter(): Promise<void> {
  const response = await fetch("/api/ai/models/update/create", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to update models from OpenRouter: ${response.statusText}`);
  }
}
