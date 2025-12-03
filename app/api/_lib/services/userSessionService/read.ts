import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { UserSession } from "./types";

/**
 * Get a user session by key
 * Returns null if session doesn't exist or is expired
 */
export async function getUserSessionByKey(key: string): Promise<UserSession | null> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT session_id, key, value, expires_at, created_at, updated_at
    FROM user_sessions
    WHERE key = ${key}
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `;

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

/**
 * Get a user session by session ID
 */
export async function getUserSessionById(sessionId: string): Promise<UserSession | null> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    SELECT session_id, key, value, expires_at, created_at, updated_at
    FROM user_sessions
    WHERE session_id = ${sessionId}
    LIMIT 1
  `;

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
