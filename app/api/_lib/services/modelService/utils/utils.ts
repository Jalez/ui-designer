import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { ollama } from "ollama-ai-provider-v2";
import type { Model } from "@/components/default/ai/models/types";
import {
  calculateImageGenerationCredits,
  calculateReasoningCredits,
  calculateRequestBasedCredits,
  calculateTextCompletionCredits,
} from "@/components/default/credits/utils/creditCalculator";
import type { ServiceUsageParams } from "../../creditService";
import type { AIProviderName } from "../types";

// Calculate cost based on model pricing and usage parameters
export function calculateModelBasedCost(params: ServiceUsageParams): number {
  if (!params.modelInfo) {
    throw new Error("Model info is required for model-based cost calculation");
  }

  const { modelInfo } = params;

  // Route to appropriate cost calculation based on service type
  switch (params.serviceName) {
    case "text_completion":
    case "AI Text Completion":
      if (!params.promptTokens || !params.completionTokens) {
        throw new Error("promptTokens and completionTokens are required for text completion");
      }
      return calculateTextCompletionCredits(
        params.promptTokens,
        params.completionTokens,
        modelInfo.pricing.prompt,
        modelInfo.pricing.completion,
      );

    case "image_generation":
    case "AI Image Generation":
      if (!params.imageCount) {
        throw new Error("imageCount is required for image generation");
      }
      return calculateImageGenerationCredits(params.imageCount, modelInfo.pricing.image);

    case "vision_ocr":
    case "Vision OCR": {
      // OCR uses vision models, so use image pricing
      const imageCount = params.imageCount || params.requestCount || 1;
      return calculateImageGenerationCredits(imageCount, modelInfo.pricing.image || modelInfo.pricing.request || "0");
    }

    case "reasoning":
      if (!params.promptTokens || !params.completionTokens) {
        throw new Error("promptTokens and completionTokens are required for reasoning");
      }
      return (
        calculateTextCompletionCredits(
          params.promptTokens,
          params.completionTokens,
          modelInfo.pricing.prompt,
          modelInfo.pricing.completion,
        ) +
        calculateReasoningCredits(params.promptTokens + params.completionTokens, modelInfo.pricing.internal_reasoning)
      );

    default: {
      // For other services, use request-based pricing
      const requestCount = params.requestCount || 1;
      return calculateRequestBasedCredits(requestCount, modelInfo.pricing.request);
    }
  }
}

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
