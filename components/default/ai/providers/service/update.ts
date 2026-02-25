import type { Provider } from "../types";

/**
 * Update an existing provider
 */
export async function updateProvider(slug: string, updates: Partial<Provider>): Promise<Provider> {
  const response = await fetch("/api/ai/providers/update-item", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slug, ...updates }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to update provider: ${response.statusText}`);
  }

  const data = await response.json();
  return data.provider;
}
