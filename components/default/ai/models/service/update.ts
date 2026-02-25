import type { Model } from "../types";

/**
 * Update an existing model
 */
export async function updateModel(id: string, updates: Partial<Model>): Promise<Model> {
  // Map frontend Model fields to backend AIModel fields
  const backendUpdates: any = { ...updates };
  
  // Map 'id' to 'model_id' (backend field name) - this is critical for updating model_id
  if (updates.id !== undefined) {
    backendUpdates.model_id = updates.id;
    delete backendUpdates.id;
  }
  
  // Map pricing fields from nested object to flat structure (if provided)
  if (updates.pricing) {
    if (updates.pricing.prompt !== undefined) {
      backendUpdates.prompt_price = parseFloat(updates.pricing.prompt) || 0;
    }
    if (updates.pricing.completion !== undefined) {
      backendUpdates.completion_price = parseFloat(updates.pricing.completion) || 0;
    }
    if (updates.pricing.image !== undefined) {
      backendUpdates.image_price = parseFloat(updates.pricing.image) || 0;
    }
    if (updates.pricing.request !== undefined) {
      backendUpdates.request_price = parseFloat(updates.pricing.request) || 0;
    }
    delete backendUpdates.pricing;
  }
  
  // Map architecture.modality to modalities array (if provided)
  if (updates.architecture?.modality !== undefined) {
    const modality = updates.architecture.modality;
    if (typeof modality === 'string') {
      backendUpdates.modalities = [modality];
    } else if (Array.isArray(modality)) {
      backendUpdates.modalities = modality;
    }
    // Note: We don't delete architecture as other fields might be used elsewhere
  }
  
  const response = await fetch(`/api/ai/models/${encodeURIComponent(id)}/update`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(backendUpdates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to update model: ${response.statusText}`);
  }

  const data = await response.json();
  return data.model;
}
