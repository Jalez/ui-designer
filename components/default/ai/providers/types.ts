export interface Provider {
  name: string;
  slug: string;
  privacy_policy_url: string | null;
  terms_of_service_url: string | null;
  status_page_url: string | null;
}

export interface ProvidersResponse {
  data: Provider[];
}

export interface ProvidersState {
  providers: Provider[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchProviders: () => Promise<void>;
  updateProvider: (slug: string, updates: Partial<Provider>) => Promise<void>;
  deleteProvider: (slug: string) => Promise<void>;
  createProvider: (provider: Omit<Provider, "slug">) => Promise<void>;

  // Optimistic updates
  setProviders: (providers: Provider[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}
