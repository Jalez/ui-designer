// Model types from OpenRouter API
export interface ModelPricing {
  prompt: string;
  completion: string;
  request: string;
  image: string;
  internal_reasoning: string;
}

export interface ModelArchitecture {
  tokenizer: string;
  instruct_type: string | null;
  modality: string;
}

export interface ModelTopProvider {
  context_length: number;
  max_completion_tokens: number | null;
  is_moderated: boolean;
}

export interface Model {
  id: string;
  canonical_slug: string;
  hugging_face_id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: ModelArchitecture;
  pricing: ModelPricing;
  top_provider: ModelTopProvider;
  per_request_limits: any | null;
  supported_parameters: string[];
  default_parameters: Record<string, any>;
  api_provider?: string; // Provider name (openai, anthropic, xai, etc.) for direct API, or "vercel-gateway" for Vercel AI Gateway
}

export interface ModelsResponse {
  data: Model[];
}

export interface ModelsState {
  models: Model[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchModels: (options?: { force?: boolean }) => Promise<void>;
  updateModel: (id: string, updates: Partial<Model>) => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  createModel: (model: Model) => Promise<void>;

  // Optimistic updates
  setModels: (models: Model[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
