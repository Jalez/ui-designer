import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Map, UpdateMapOptions } from "./types";

/**
 * Update a map by name
 */
export async function updateMap(
  name: string,
  options: UpdateMapOptions
): Promise<Map | null> {
  const sqlInstance = await sql();

  // Build update query dynamically based on provided options
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (options.random !== undefined) {
    updates.push(`random = $${paramIndex++}`);
    values.push(options.random);
  }

  if (options.can_use_ai !== undefined) {
    updates.push(`can_use_ai = $${paramIndex++}`);
    values.push(options.can_use_ai);
  }

  if (options.easy_level_points !== undefined) {
    updates.push(`easy_level_points = $${paramIndex++}`);
    values.push(options.easy_level_points);
  }

  if (options.medium_level_points !== undefined) {
    updates.push(`medium_level_points = $${paramIndex++}`);
    values.push(options.medium_level_points);
  }

  if (options.hard_level_points !== undefined) {
    updates.push(`hard_level_points = $${paramIndex++}`);
    values.push(options.hard_level_points);
  }

  if (updates.length === 0) {
    // No updates provided, just return the current map
    const result = await sqlInstance`
      SELECT 
        name, random, can_use_ai, easy_level_points, 
        medium_level_points, hard_level_points, created_at, updated_at
      FROM maps
      WHERE name = ${name}
      LIMIT 1
    `;
    
    const rows = extractRows(result);
    return rows.length > 0 ? {
      name: rows[0].name,
      random: rows[0].random,
      can_use_ai: rows[0].can_use_ai,
      easy_level_points: rows[0].easy_level_points,
      medium_level_points: rows[0].medium_level_points,
      hard_level_points: rows[0].hard_level_points,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
    } : null;
  }

  values.push(name);

  const result = await sqlInstance.unsafe(
    `UPDATE maps 
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE name = $${paramIndex}
     RETURNING name, random, can_use_ai, easy_level_points, 
               medium_level_points, hard_level_points, created_at, updated_at`,
    values
  );

  const rows = extractRows(result);

  if (rows.length === 0) {
    return null;
  }

  return {
    name: rows[0].name,
    random: rows[0].random,
    can_use_ai: rows[0].can_use_ai,
    easy_level_points: rows[0].easy_level_points,
    medium_level_points: rows[0].medium_level_points,
    hard_level_points: rows[0].hard_level_points,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}
