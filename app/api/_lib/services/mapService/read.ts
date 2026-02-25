import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Map, MapWithLevels } from "./types";

/**
 * Get a map by name
 */
export async function getMapByName(name: string): Promise<Map | null> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT 
      name, random, can_use_ai, easy_level_points, 
      medium_level_points, hard_level_points, created_at, updated_at
    FROM maps
    WHERE name = ${name}
    LIMIT 1
  `;

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

/**
 * Get all maps
 */
export async function getAllMaps(): Promise<Map[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT 
      name, random, can_use_ai, easy_level_points, 
      medium_level_points, hard_level_points, created_at, updated_at
    FROM maps
    ORDER BY created_at DESC
  `;

  const rows = extractRows(result);

  return rows.map((row) => ({
    name: row.name,
    random: row.random,
    can_use_ai: row.can_use_ai,
    easy_level_points: row.easy_level_points,
    medium_level_points: row.medium_level_points,
    hard_level_points: row.hard_level_points,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get map names only
 */
export async function getAllMapNames(): Promise<string[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT name
    FROM maps
    ORDER BY name ASC
  `;

  const rows = extractRows(result);

  return rows.map((row) => row.name);
}

/**
 * Get a map with its levels
 */
export async function getMapWithLevels(mapName: string): Promise<MapWithLevels | null> {
  const sqlInstance = await sql();

  // Get map first
  const mapResult = await sqlInstance`
    SELECT 
      name, random, can_use_ai, easy_level_points, 
      medium_level_points, hard_level_points, created_at, updated_at
    FROM maps
    WHERE name = ${mapName}
    LIMIT 1
  `;

  const mapRows = extractRows(mapResult);

  if (mapRows.length === 0) {
    return null;
  }

  // Get levels for this map
  const levelsResult = await sqlInstance`
    SELECT l.identifier, l.name, l.json
    FROM levels l
    INNER JOIN map_levels ml ON ml.level_identifier = l.identifier
    WHERE ml.map_name = ${mapName}
    ORDER BY l.name ASC
  `;

  const levelRows = extractRows(levelsResult);

  return {
    name: mapRows[0].name,
    random: mapRows[0].random,
    can_use_ai: mapRows[0].can_use_ai,
    easy_level_points: mapRows[0].easy_level_points,
    medium_level_points: mapRows[0].medium_level_points,
    hard_level_points: mapRows[0].hard_level_points,
    created_at: mapRows[0].created_at,
    updated_at: mapRows[0].updated_at,
    levels: levelRows.map((row) => ({
      identifier: row.identifier,
      name: row.name,
      json: row.json,
    })),
  };
}

/**
 * Get levels for a specific map
 */
export async function getLevelsForMap(mapName: string): Promise<Array<{
  identifier: string;
  name: string;
  json: Record<string, any>;
}>> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT l.identifier, l.name, l.json
    FROM levels l
    INNER JOIN map_levels ml ON ml.level_identifier = l.identifier
    WHERE ml.map_name = ${mapName}
    ORDER BY l.name ASC
  `;

  const rows = extractRows(result);

  return rows.map((row) => ({
    identifier: row.identifier,
    name: row.name,
    json: row.json,
  }));
}
