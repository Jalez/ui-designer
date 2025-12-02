import { extractRows, getSqlInstance } from "../../db/shared";
import type { AIModel } from "./types";

/**
 * Update an existing AI model
 */
export async function updateModel(modelId: string, updates: Partial<AIModel>): Promise<AIModel> {
  const sql = await getSqlInstance();
  const now = new Date();

  // Handle model_id update separately if provided
  let finalModelId = modelId;
  if (updates.model_id && updates.model_id !== modelId) {
    // Check if new model_id already exists
    const existingCheck = await sql`
      SELECT model_id FROM ai_models WHERE model_id = ${updates.model_id}
    `;
    const existingRows = extractRows(existingCheck);
    if (existingRows.length > 0) {
      throw new Error(`Model with ID "${updates.model_id}" already exists`);
    }
    finalModelId = updates.model_id;
  }

  // Handle api_provider separately to allow null/empty values
  const apiProviderValue = updates.api_provider !== undefined 
    ? (updates.api_provider === "" ? null : updates.api_provider)
    : undefined;

  const result = await sql`
    UPDATE ai_models
    SET
      model_id = ${finalModelId},
      name = COALESCE(${updates.name}, name),
      provider_slug = COALESCE(${updates.provider_slug}, provider_slug),
      description = COALESCE(${updates.description}, description),
      context_length = COALESCE(${updates.context_length}, context_length),
      modalities = COALESCE(${updates.modalities}, modalities),
      prompt_price = COALESCE(${updates.prompt_price}, prompt_price),
      completion_price = COALESCE(${updates.completion_price}, completion_price),
      image_price = COALESCE(${updates.image_price}, image_price),
      request_price = COALESCE(${updates.request_price}, request_price),
      api_provider = ${apiProviderValue !== undefined ? apiProviderValue : sql`api_provider`},
      is_active = COALESCE(${updates.is_active}, is_active),
      updated_at = ${now}
    WHERE model_id = ${modelId}
    RETURNING *
  `;

  const rows = extractRows(result);
  if (!rows || rows.length === 0) {
    throw new Error("Model not found or update failed");
  }

  return rows[0] as AIModel;
}

/**
 * Sync models from OpenRouter API
 */
export async function syncModelsFromOpenRouter(): Promise<{ synced: number; errors: string[] }> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }

    const data = await response.json();
    const models = data.data || [];

    const sql = await getSqlInstance();
    let synced = 0;
    const errors: string[] = [];

    for (const model of models) {
      try {
        const now = new Date();

        // Upsert model
        await sql`
          INSERT INTO ai_models (
            id,
            model_id,
            name,
            provider_slug,
            description,
            context_length,
            modalities,
            prompt_price,
            completion_price,
            image_price,
            request_price,
            is_active,
            created_at,
            updated_at
          ) VALUES (
            ${crypto.randomUUID()},
            ${model.id},
            ${model.name || model.id},
            ${model.provider || null},
            ${model.description || null},
            ${model.context_length || null},
            ${model.modalities || null},
            ${model.pricing?.prompt || null},
            ${model.pricing?.completion || null},
            ${model.pricing?.image || null},
            ${model.pricing?.request || null},
            true,
            ${now},
            ${now}
          )
          ON CONFLICT (model_id)
          DO UPDATE SET
            name = EXCLUDED.name,
            provider_slug = EXCLUDED.provider_slug,
            description = EXCLUDED.description,
            context_length = EXCLUDED.context_length,
            modalities = EXCLUDED.modalities,
            prompt_price = EXCLUDED.prompt_price,
            completion_price = EXCLUDED.completion_price,
            image_price = EXCLUDED.image_price,
            request_price = EXCLUDED.request_price,
            updated_at = ${now}
        `;

        synced++;
      } catch (error) {
        errors.push(`Failed to sync model ${model.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { synced, errors };
  } catch (error) {
    throw new Error(
      `Failed to sync models from OpenRouter: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
