import type { Provider } from "../types";

/**
 * Fetch all providers from the API
 */
export async function getProviders(): Promise<Provider[]> {
  const response = await fetch("/api/ai/providers/read");

  if (!response.ok) {
    throw new Error(`Failed to fetch providers: ${response.statusText}`);
  }

  const data = await response.json();
  return data.providers;
}

/**
 * Fetch a single provider by slug
 */
export async function getProviderBySlug(slug: string): Promise<Provider | null> {
  const providers = await getProviders();
  return providers.find((p) => p.slug === slug) || null;
}

/**
 * Update providers from OpenRouter API
 */
export async function updateProvidersFromOpenRouter(): Promise<void> {
  const response = await fetch("/api/ai/providers/update", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to update providers from OpenRouter: ${response.statusText}`);
  }
}
