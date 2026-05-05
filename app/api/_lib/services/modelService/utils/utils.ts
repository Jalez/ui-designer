import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { ollama } from "ollama-ai-provider-v2";
import type { Model } from "@/components/default/ai/models/types";
import type { AIProviderName } from "../types";

// Provider configurations
export const providers = {
  openai: openai,
  ollama: ollama,
} as const;

/**
 * Get provider and model based on model information
 */
export function getModelFromModelInfo(modelInfo: Model): LanguageModel {
  // Check if model has a provider field first (for database models)
  if ("provider" in modelInfo && modelInfo.provider) {
    const provider = providers[modelInfo.provider as keyof typeof providers];
    if (!provider) {
      throw new Error(`Unsupported provider: ${modelInfo.provider}`);
    }

    // For Ollama models, use the canonical slug
    if (modelInfo.provider === "ollama") {
      return provider(modelInfo.canonical_slug);
    }

    // For other providers, use the canonical model name
    return provider(modelInfo.canonical_slug);
  }

  // Fallback: Extract provider from model ID (format: provider/model-name)
  const [providerName, modelName] = modelInfo.id.split("/");

  if (!providerName || !modelName) {
    throw new Error(
      `Invalid model ID format: ${modelInfo.id}. Model must have provider field or follow provider/model-name format.`,
    );
  }

  const provider = providers[providerName as keyof typeof providers];
  if (!provider) {
    throw new Error(`Unsupported provider: ${providerName}`);
  }

  // For Ollama models, use the full model name
  if (providerName === "ollama") {
    return provider(modelName);
  }

  // For other providers, use the canonical model name
  return provider(modelName);
}

/**
 * Get provider name from model ID
 */
export function getProviderFromModelId(modelId: string): AIProviderName {
  const [providerName] = modelId.split("/");
  return providerName as AIProviderName;
}

/**
 * Check if a model is a local Ollama model
 */
export function isLocalModel(modelId: string): boolean {
  return modelId.startsWith("ollama/");
}
