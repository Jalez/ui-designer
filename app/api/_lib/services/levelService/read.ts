import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Level } from "./types";

/**
 * Get a level by identifier
 */
export async function getLevelByIdentifier(identifier: string): Promise<Level | null> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT identifier, name, json, created_at, updated_at
    FROM levels
    WHERE identifier = ${identifier}
    LIMIT 1
  `;

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

/**
 * Get all levels
 */
export async function getAllLevels(): Promise<Level[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT identifier, name, json, created_at, updated_at
    FROM levels
    ORDER BY created_at DESC
  `;

  const rows = extractRows(result);

  return rows.map((row) => ({
    identifier: row.identifier,
    name: row.name,
    json: row.json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get level names only
 */
export async function getAllLevelNames(): Promise<string[]> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT name
    FROM levels
    ORDER BY name ASC
  `;

  const rows = extractRows(result);

  return rows.map((row) => row.name);
}
