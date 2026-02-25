import { extractRows, getSqlInstance } from "../../db/shared";
import type { DatabaseUserDefaultModels } from "./types";

type GetUserDefaultsParams = {
  userId: string;
};

/**
 * Get user default models by email
 */
export async function getUserDefaults({ userId }: GetUserDefaultsParams): Promise<DatabaseUserDefaultModels | null> {
  const sqlInstance = await getSqlInstance();

  const result = await sqlInstance`
    SELECT * FROM user_default_models WHERE user_id = ${userId}
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  return rows[0] as DatabaseUserDefaultModels;
}
