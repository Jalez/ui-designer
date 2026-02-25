import type { Provider } from "../types";

/**
 * Create a new provider
 */
export async function createProvider(provider: Omit<Provider, "slug">): Promise<Provider> {
  const response = await fetch("/api/ai/providers/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(provider),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `Failed to create provider: ${response.statusText}`);
  }

  const data = await response.json();
  return data.provider;
}
