import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Map, CreateMapOptions } from "./types";

/**
 * Create a new map
 */
export async function createMap(options: CreateMapOptions): Promise<Map> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    INSERT INTO maps (
      name, 
      random, 
      can_use_ai, 
      easy_level_points, 
      medium_level_points, 
      hard_level_points
    )
    VALUES (
      ${options.name}, 
      ${options.random ?? 0}, 
      ${options.can_use_ai ?? false}, 
      ${options.easy_level_points}, 
      ${options.medium_level_points}, 
      ${options.hard_level_points}
    )
    RETURNING 
      name, random, can_use_ai, easy_level_points, 
      medium_level_points, hard_level_points, created_at, updated_at
  `;

  const rows = extractRows(result);
  
  if (rows.length === 0) {
    throw new Error("Failed to create map");
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

/**
 * Add a level to a map
 */
export async function addLevelToMap(mapName: string, levelIdentifier: string): Promise<void> {
  const sqlInstance = await sql();

  await sqlInstance`
    INSERT INTO map_levels (map_name, level_identifier)
    VALUES (${mapName}, ${levelIdentifier})
    ON CONFLICT (map_name, level_identifier) DO NOTHING
  `;
}
