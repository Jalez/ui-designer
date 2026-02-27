'use client';

import { useMemo, useState } from "react";

const STORAGE_KEY = "ui-designer-ai-provider-config";

export type AIProviderConfig = {
  apiEndpoint: string;
  model: string;
  apiKey: string;
};

const defaultConfig: AIProviderConfig = {
  apiEndpoint: process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL || "openai/gpt-4o-mini",
  apiKey: "",
};

export function useAIProviderConfig() {
  const [config, setConfig] = useState<AIProviderConfig>(() => {
    if (typeof window === "undefined") {
      return defaultConfig;
    }

    try {
      const savedConfig = window.localStorage.getItem(STORAGE_KEY);
      if (!savedConfig) {
        return defaultConfig;
      }

      const parsed = JSON.parse(savedConfig) as Partial<AIProviderConfig>;
      return {
        apiEndpoint: parsed.apiEndpoint || defaultConfig.apiEndpoint,
        model: parsed.model || defaultConfig.model,
        apiKey: parsed.apiKey || defaultConfig.apiKey,
      };
    } catch (error) {
      console.warn("Failed to read AI provider config from localStorage", error);
      return defaultConfig;
    }
  });

  const updateConfig = (updates: Partial<AIProviderConfig>) => {
    setConfig((current) => {
      const nextConfig = { ...current, ...updates };
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
      }
      return nextConfig;
    });
  };

  return useMemo(
    () => ({
      config,
      setApiEndpoint: (apiEndpoint: string) => updateConfig({ apiEndpoint }),
      setModel: (model: string) => updateConfig({ model }),
      setApiKey: (apiKey: string) => updateConfig({ apiKey }),
      resetToDefaults: () => {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
        setConfig(defaultConfig);
      },
    }),
    [config],
  );
}
