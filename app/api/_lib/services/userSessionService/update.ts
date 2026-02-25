import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { UserSession, UpdateUserSessionOptions } from "./types";

/**
 * Update a user session by key
 */
export async function updateUserSession(
  key: string,
  options: UpdateUserSessionOptions
): Promise<UserSession | null> {
  const sqlInstance = await sql();

  // Build update query dynamically based on provided options
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (options.value !== undefined) {
    updates.push(`value = $${paramIndex++}`);
    values.push(options.value);
  }

  if (options.expiresAt !== undefined) {
    updates.push(`expires_at = $${paramIndex++}`);
    values.push(options.expiresAt);
  }

  if (updates.length === 0) {
    // No updates provided, just return the current session
    const result = await sqlInstance`
      SELECT session_id, key, value, expires_at, created_at, updated_at
      FROM user_sessions
      WHERE key = ${key}
      LIMIT 1
    `;
    
    const rows = extractRows(result);
    return rows.length > 0 ? {
      session_id: rows[0].session_id,
      key: rows[0].key,
      value: rows[0].value,
      expires_at: rows[0].expires_at,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
    } : null;
  }

  values.push(key);

  const result = await sqlInstance.unsafe(
    `UPDATE user_sessions 
     SET ${updates.join(", ")}, updated_at = NOW()
     WHERE key = $${paramIndex}
     RETURNING session_id, key, value, expires_at, created_at, updated_at`,
    values
  );

  const rows = extractRows(result);

  if (rows.length === 0) {
    return null;
  }

  return {
    session_id: rows[0].session_id,
    key: rows[0].key,
    value: rows[0].value,
    expires_at: rows[0].expires_at,
    created_at: rows[0].created_at,
    updated_at: rows[0].updated_at,
  };
}
