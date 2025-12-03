import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";

/**
 * Delete a level by identifier
 */
export async function deleteLevel(identifier: string): Promise<boolean> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    DELETE FROM levels
    WHERE identifier = ${identifier}
    RETURNING identifier
  `;

  const rows = extractRows(result);

  return rows.length > 0;
}
