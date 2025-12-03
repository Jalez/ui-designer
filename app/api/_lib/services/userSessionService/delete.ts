import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";

/**
 * Delete a user session by key
 */
export async function deleteUserSession(key: string): Promise<boolean> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    DELETE FROM user_sessions
    WHERE key = ${key}
    RETURNING session_id
  `;

  const rows = extractRows(result);

  return rows.length > 0;
}

/**
 * Delete expired user sessions
 */
export async function deleteExpiredUserSessions(): Promise<number> {
  const sqlInstance = await sql();

  const result = await sqlInstance`
    DELETE FROM user_sessions
    WHERE expires_at IS NOT NULL AND expires_at < NOW()
    RETURNING session_id
  `;

  const rows = extractRows(result);

  return rows.length;
}
