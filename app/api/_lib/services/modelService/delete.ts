import { getSqlInstance } from "../../db/shared";

/**
 * Delete models by IDs
 */
export async function deleteModels(modelIds: string[]): Promise<{ deleted: number }> {
  if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    throw new Error("Invalid request: modelIds array required");
  }

  const sql = await getSqlInstance();

  const result = await sql`
    DELETE FROM ai_models
    WHERE model_id = ANY(${modelIds})
  `;

  const deleted = Array.isArray(result) ? result.length : result.rowCount || 0;

  return { deleted };
}

/**
 * Soft delete models (mark as inactive)
 */
export async function deactivateModels(modelIds: string[]): Promise<{ deactivated: number }> {
  if (!modelIds || !Array.isArray(modelIds) || modelIds.length === 0) {
    throw new Error("Invalid request: modelIds array required");
  }

  const sql = await getSqlInstance();

  const result = await sql`
    UPDATE ai_models
    SET is_active = false, updated_at = NOW()
    WHERE model_id = ANY(${modelIds})
  `;

  const deactivated = Array.isArray(result) ? result.length : result.rowCount || 0;

  return { deactivated };
}
