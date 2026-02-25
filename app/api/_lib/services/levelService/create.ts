import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { Level, CreateLevelOptions } from "./types";

/**
 * Create a new level
 */
export async function createLevel(options: CreateLevelOptions): Promise<Level> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    INSERT INTO levels (name, json)
    VALUES (${options.name}, ${JSON.stringify(options.json)})
    RETURNING identifier, name, json, created_at, updated_at
  `;

  const rows = extractRows(result);
  
  if (rows.length === 0) {
    throw new Error("Failed to create level");
  }

  return {
    identifier: rows[0].identifier,
    name: rows[0].name,
    json: rows[0].json,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}
