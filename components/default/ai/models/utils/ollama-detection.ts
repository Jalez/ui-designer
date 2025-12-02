/**
 * Client-side Ollama Model Detection Utility
 *
 * Detects locally available Ollama models and includes them in the model list.
 * This runs on the client-side to check for local Ollama installation.
 */

import type { Model } from "../types";

export interface OllamaModel extends Model {
  provider: "ollama";
  isLocal: true;
  baseUrl?: string;
}

/**
 * Detect if Ollama is available locally
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    // Check if OLLAMA_BASE_URL is set (indicates local Ollama is configured)
    if (typeof window !== "undefined" && (window as any).OLLAMA_BASE_URL) {
      return true;
    }

    // Try to detect Ollama by making a request to the default local endpoint
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(2000), // 2 second timeout
    }).catch(() => null);

    return response?.ok === true;
  } catch (_error) {
    return false;
  }
}

/**
 * Get available Ollama models from local installation
 */
export async function getOllamaModels(): Promise<OllamaModel[]> {
  if (!(await isOllamaAvailable())) {
    return [];
  }

  try {
    const baseUrl = (typeof window !== "undefined" && (window as any).OLLAMA_BASE_URL) || "http://localhost:11434";
    const response = await fetch(`${baseUrl}/api/tags`);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();

    return (
      data.models?.map((model: any) => ({
        id: `ollama/${model.name}`,
        canonical_slug: model.name,
        hugging_face_id: model.name,
        name: model.name,
        created: Date.now(),
        description: `Local Ollama model: ${model.name}`,
        context_length: model.details?.context_length || 4096,
        architecture: {
          tokenizer: "unknown",
          instruct_type: null,
          modality: "text->text", // Default assumption - may not be accurate for all models
        },
        pricing: {
          prompt: "0", // Free for local models
          completion: "0",
          request: "0",
          image: "0",
          internal_reasoning: "0",
        },
        top_provider: {
          context_length: model.details?.context_length || 4096,
          max_completion_tokens: model.details?.max_completion_tokens || 4096,
          is_moderated: false,
        },
        per_request_limits: null,
        supported_parameters: ["temperature", "top_p", "max_tokens"],
        default_parameters: {},
        provider: "ollama" as const,
        isLocal: true,
        baseUrl,
        // Add metadata to indicate this is a local model with unknown capabilities
        _localModelWarning: "Model capabilities cannot be verified - may not support all features",
      })) || []
    );
  } catch (error) {
    console.warn("Failed to fetch Ollama models:", error);
    return [];
  }
}

/**
 * Get all models including local Ollama models
 */
export async function getAllModelsWithLocal(): Promise<Model[]> {
  // TODO: Import the existing model fetching logic when AI services are integrated
  // const { getModels } = await import("../service/get");

  try {
    // Get local Ollama models
    const ollamaModels = await getOllamaModels();

    // Return just local models for now
    return [...ollamaModels];
  } catch (error) {
    console.error("Error fetching models:", error);
    return [];
  }
}

/**
 * Check for local models and show notification if found
 */
export async function checkAndNotifyLocalModels(): Promise<Model[]> {
  const allModels = await getAllModelsWithLocal();
  const localModels = allModels.filter((m) => m.id.startsWith("ollama/"));

  if (localModels.length > 0) {
    // Log for debugging - UI warning card will be shown in settings page
    console.log(
      `Found ${localModels.length} local Ollama models:`,
      localModels.map((m) => m.name),
    );
  }

  return allModels;
}
