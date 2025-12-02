export interface AIModel {
  model_id: string;
  name: string;
  provider_slug?: string;
  description?: string;
  context_length?: number;
  modalities?: string[];
  prompt_price?: number;
  completion_price?: number;
  image_price?: number;
  request_price?: number;
  api_provider?: string; // Provider name (openai, anthropic, xai, etc.) for direct API, or "vercel-gateway" for Vercel AI Gateway
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// AI Provider utilities
export type AIProviderName = "openai" | "ollama";

// Model usage statistics
export interface ModelUsage {
  model_id: string;
  model_name: string;
  provider: string;
  usage_count: number;
  total_credits: number;
  total_cost: number;
}
