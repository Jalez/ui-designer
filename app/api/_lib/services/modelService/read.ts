import { getOllamaModels } from "@/components/default/ai/models/utils/ollama-detection";
import { extractRows, getSqlInstance } from "../../db/shared";

/**
 * Get available models from database and Ollama
 * Can be called from any API route without authentication
 */
export async function getAvailableModels() {
  let dbModels = [];

  try {
    const sql = await getSqlInstance();
    const result = await sql`
      SELECT
        model_id as id,
        name,
        provider_slug,
        description,
        context_length,
        modalities,
        prompt_price,
        completion_price,
        image_price,
        request_price,
        supports_tool_use,
        api_provider,
        is_active,
        created_at as created
      FROM ai_models
      WHERE is_active = true
      ORDER BY name
    `;

    dbModels = extractRows(result).map((row: any) => ({
      id: row.id,
      name: row.name,
      canonical_slug: row.id,
      hugging_face_id: "",
      description: row.description || "",
      created: row.created ? new Date(row.created).getTime() / 1000 : Date.now() / 1000,
      context_length: row.context_length || 0,
      provider: row.provider_slug, // Add provider field for getModelFromModelInfo
      api_provider: row.api_provider || undefined, // Include api_provider field
      architecture: {
        tokenizer: row.provider_slug || "Unknown",
        instruct_type: null,
        modality: row.modalities ? row.modalities.join(", ") : "unknown",
      },
      pricing: {
        prompt: row.prompt_price ? row.prompt_price.toString() : "0",
        completion: row.completion_price ? row.completion_price.toString() : "0",
        request: row.request_price ? row.request_price.toString() : "0",
        image: row.image_price ? row.image_price.toString() : "0",
        internal_reasoning: "0",
      },
      top_provider: {
        context_length: row.context_length || 0,
        max_completion_tokens: null,
        is_moderated: false,
      },
      per_request_limits: null,
      supported_parameters: [],
      default_parameters: {},
      supportsToolUse: Boolean(row.supports_tool_use),
    }));
  } catch (dbError) {
    console.error("Error fetching models from database:", dbError);
    throw new Error(
      `Failed to fetch models from database: ${dbError instanceof Error ? dbError.message : "Unknown error"}`,
    );
  }

  let localModels = [];
  try {
    localModels = await getOllamaModels();
  } catch (ollamaError) {
    console.warn("Failed to fetch local Ollama models:", ollamaError);
  }

  const allModels = [...dbModels, ...localModels];

  if (allModels.length === 0) {
    throw new Error("No AI models are currently available.");
  }


  return allModels;
}
