export interface OpenRouterProvider {
  id: string;
  name: string;
  description?: string;
  models?: string[];
  website?: string;
  privacy_policy?: string;
  terms_of_service?: string;
  status_page?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt?: number;
    completion?: number;
    image?: number;
    request?: number;
  };
  context_length?: number;
  provider?: string;
  modalities?: string[];
}

interface OpenRouterData {
  providers: OpenRouterProvider[];
  models: OpenRouterModel[];
}

export async function fetchOpenRouterData(): Promise<OpenRouterData> {
  // Fetch providers and models directly from OpenRouter API
  const [providersResponse, modelsResponse] = await Promise.all([
    fetch("https://openrouter.ai/api/v1/providers", {
      headers: {
        "Content-Type": "application/json",
      },
    }),
    fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Content-Type": "application/json",
      },
    }),
  ]);

  if (!providersResponse.ok) {
    throw new Error(`OpenRouter providers API error: ${providersResponse.statusText}`);
  }

  if (!modelsResponse.ok) {
    throw new Error(`OpenRouter models API error: ${modelsResponse.statusText}`);
  }

  const providersData = await providersResponse.json();
  const modelsData = await modelsResponse.json();

  return {
    providers: providersData.data || [],
    models: modelsData.data || [],
  };
}
