import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Level, UpdateLevelOptions } from "./types";

/**
 * Update a level by identifier
 */
export async function updateLevel(
  identifier: string,
  options: UpdateLevelOptions
): Promise<Level | null> {
  const sqlInstance = await sql();

  // Build update query dynamically based on provided options
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (options.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(options.name);
  }

  if (options.json !== undefined) {
    updates.push(`json = $${paramIndex++}`);
    values.push(JSON.stringify(options.json));
  }

  if (updates.length === 0) {
    // No updates provided, just return the current level
    const result = await sqlInstance`
      SELECT identifier, name, json, created_at, updated_at
      FROM levels
      WHERE identifier = ${identifier}
      LIMIT 1
    `;
    
    const rows = extractRows(result);
    return rows.length > 0 ? {
      identifier: rows[0].identifier,
      name: rows[0].name,
      json: rows[0].json,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
    } : null;
  }

  values.push(identifier);

  const result = await sqlInstance.unsafe(
    `UPDATE levels 
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE identifier = $${paramIndex}
     RETURNING identifier, name, json, created_at, updated_at`,
    values
  );

  const rows = extractRows(result);

  if (rows.length === 0) {
    return null;
  }

  return {
    identifier: rows[0].identifier,
    name: rows[0].name,
    json: rows[0].json,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}
