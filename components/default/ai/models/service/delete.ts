/**
 * Delete a model
 */
export async function deleteModel(id: string): Promise<void> {
  const response = await fetch(`/api/ai/models/${encodeURIComponent(id)}/delete`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to delete model: ${response.statusText}`);
  }
}

/**
 * Delete multiple models
 */
export async function deleteModels(ids: string[]): Promise<void> {
  // Delete models one by one since the new API expects individual deletion
  for (const id of ids) {
    await deleteModel(id);
  }
}
