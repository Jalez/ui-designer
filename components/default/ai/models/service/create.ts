import type { Model } from "../types";

/**
 * Create a new model
 */
export async function createModel(model: Model): Promise<Model> {
  const response = await fetch("/api/ai/models/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(model),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to create model: ${response.statusText}`);
  }

  const data = await response.json();
  return data.model;
}
