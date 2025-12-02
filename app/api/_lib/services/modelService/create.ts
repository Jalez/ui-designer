import { randomUUID } from "node:crypto";
import { extractRows, getSqlInstance } from "../../db/shared";
import type { AIModel } from "./types";

/**
 * Create a new AI model
 */
export async function createModel(modelData: Partial<AIModel>): Promise<AIModel> {
  if (!modelData.model_id || !modelData.name) {
    throw new Error("Model ID and name are required");
  }

  const sql = await getSqlInstance();
  const now = new Date();

  const result = await sql`
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
      api_provider,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      ${randomUUID()},
      ${modelData.model_id},
      ${modelData.name},
      ${modelData.provider_slug || null},
      ${modelData.description || null},
      ${modelData.context_length || null},
      ${modelData.modalities || null},
      ${modelData.prompt_price || null},
      ${modelData.completion_price || null},
      ${modelData.image_price || null},
      ${modelData.request_price || null},
      ${modelData.api_provider || null},
      ${modelData.is_active ?? true},
      ${now},
      ${now}
    )
    RETURNING *
  `;

  const rows = extractRows(result);
  if (!rows || rows.length === 0) {
    throw new Error("Failed to create model");
  }

  return rows[0] as AIModel;
}
