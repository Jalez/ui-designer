/**
 * Delete a provider
 */
export async function deleteProvider(slug: string): Promise<void> {
  const response = await fetch("/api/ai/providers/delete", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slugs: [slug] }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to delete provider: ${response.statusText}`);
  }
}

/**
 * Delete multiple providers
 */
export async function deleteProviders(slugs: string[]): Promise<void> {
  const response = await fetch("/api/ai/providers/delete", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slugs }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to delete providers: ${response.statusText}`);
  }
}
