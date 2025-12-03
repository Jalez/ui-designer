import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { UserSession, CreateUserSessionOptions } from "./types";

/**
 * Create or update a user session
 * If a session with the same key exists, it will be updated
 */
export async function createOrUpdateUserSession(options: CreateUserSessionOptions): Promise<UserSession> {
  const sqlInstance = await sql();

  // First, try to find existing session by key
  const existing = await sqlInstance`
    SELECT session_id, key, value, expires_at, created_at, updated_at
    FROM user_sessions
    WHERE key = ${options.key}
    LIMIT 1
  `;

  const existingRows = extractRows(existing);

  if (existingRows.length > 0) {
    // Update existing session
    const result = await sqlInstance`
      UPDATE user_sessions
      SET 
        value = ${options.value ?? null},
        expires_at = ${options.expiresAt ?? null},
        updated_at = NOW()
      WHERE key = ${options.key}
      RETURNING session_id, key, value, expires_at, created_at, updated_at
    `;

    const rows = extractRows(result);
    
    return {
      session_id: rows[0].session_id,
      key: rows[0].key,
      value: rows[0].value,
      expires_at: rows[0].expires_at,
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
    };
  }

  // Create new session
  const result = await sqlInstance`
    INSERT INTO user_sessions (key, value, expires_at)
    VALUES (${options.key}, ${options.value ?? null}, ${options.expiresAt ?? null})
    RETURNING session_id, key, value, expires_at, created_at, updated_at
  `;

  const rows = extractRows(result);
  
  if (rows.length === 0) {
    throw new Error("Failed to create user session");
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
