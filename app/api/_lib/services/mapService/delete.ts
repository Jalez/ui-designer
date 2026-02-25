import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";

/**
 * Delete a map by name
 * Note: This will also delete all map_levels entries due to CASCADE
 */
export async function deleteMap(name: string): Promise<boolean> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    DELETE FROM maps
    WHERE name = ${name}
    RETURNING name
  `;

  const rows = extractRows(result);

  return rows.length > 0;
}

/**
 * Remove a level from a map
 */
export async function removeLevelFromMap(mapName: string, levelIdentifier: string): Promise<boolean> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    DELETE FROM map_levels
    WHERE map_name = ${mapName} AND level_identifier = ${levelIdentifier}
    RETURNING map_name
  `;

  const rows = extractRows(result);

  return rows.length > 0;
}
