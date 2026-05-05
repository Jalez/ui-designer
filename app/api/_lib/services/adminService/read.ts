import { extractRows, getSqlInstance } from "../../db/shared";
import type { AdminUser } from "./types";

/**
 * Resolve admin status for a session, checking ADMIN_EMAIL env var first
 * (dev/Docker fallback) then the admin_roles DB table. Matches the logic
 * in layout-client.tsx so all code paths agree on who is admin.
 */
export async function resolveSessionAdmin(session: {
  userId?: string | null;
  user?: { email?: string | null } | null;
} | null): Promise<boolean> {
  if (!session) return false;
  const email = session.user?.email?.trim() ?? null;
  const userId = session.userId ?? null;

  const adminEmailEnv = process.env.ADMIN_EMAIL?.trim();
  if (email && adminEmailEnv && email.toLowerCase() === adminEmailEnv.toLowerCase()) {
    return true;
  }

  if (email) {
    const byEmail = await isAdminByEmail(email);
    if (byEmail) return true;
  }
  if (userId) {
    return isAdmin(userId);
  }
  return false;
}

/**
 * Check if a user is an admin by user ID
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const sql = await getSqlInstance();
    const result = await sql`
      SELECT ar.id FROM admin_roles ar
      WHERE ar.user_id = ${userId}
      AND ar.is_active = true
      LIMIT 1
    `;

    const rows = extractRows(result);
    return rows.length > 0;
  } catch (error) {
    console.error("DB: CONNECTION-FAIL: Error checking admin status. This often indicates the PostgreSQL Docker container is not running. Please check that your database container is started:", error);
    return false;
  }
}

/**
 * Check if a user is an admin by email (case-insensitive).
 * Use this when resolving admin status from session.user.email so the seeded
 * admin (e.g. raitsu11@gmail.com) matches regardless of Google's email casing.
 */
export async function isAdminByEmail(email: string | null | undefined): Promise<boolean> {
  if (!email || typeof email !== "string" || !email.trim()) {
    return false;
  }
  try {
    const sql = await getSqlInstance();
    const normalized = email.trim().toLowerCase();
    const result = await sql`
      SELECT ar.id
      FROM admin_roles ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.is_active = true
      AND LOWER(TRIM(u.email)) = ${normalized}
      LIMIT 1
    `;
    const rows = extractRows(result);
    return rows.length > 0;
  } catch (error) {
    console.error("DB: CONNECTION-FAIL: Error checking admin by email:", error);
    return false;
  }
}

/**
 * If the given email (case-insensitive) matches an existing admin's email, ensure
 * the given userId also has an admin role. Use when the signed-in user might be a
 * different user row (e.g. Google sign-in created a duplicate) but same email.
 */
export async function ensureAdminForEmailMatch(
  email: string | null | undefined,
  userId: string,
): Promise<boolean> {
  if (!email || typeof email !== "string" || !email.trim() || !userId) {
    return false;
  }
  try {
    const sql = await getSqlInstance();
    const normalized = email.trim().toLowerCase();
    const existing = await sql`
      SELECT ar.user_id
      FROM admin_roles ar
      JOIN users u ON ar.user_id = u.id
      WHERE ar.is_active = true
      AND LOWER(TRIM(u.email)) = ${normalized}
      LIMIT 1
    `;
    const rows = extractRows(existing);
    if (rows.length === 0) return false;
    const adminUserId = (rows[0] as { user_id: string }).user_id;
    const targetUserLookup = await sql`
      SELECT id
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    const targetRows = extractRows(targetUserLookup) as Array<{ id: string }>;
    let targetUserId = userId;

    // Old sessions can carry a provider-side or stale userId that is not a real row in users.
    // In that case, resolve the canonical DB user by email and sync admin to that row instead.
    if (targetRows.length === 0) {
      const { getOrCreateUserByEmail } = await import("../userService");
      const resolvedUser = await getOrCreateUserByEmail(normalized);
      targetUserId = resolvedUser.id;
    }

    if (adminUserId === targetUserId) return true;
    const { addAdmin } = await import("./create");
    return addAdmin(targetUserId, "admin", adminUserId);
  } catch (error) {
    console.error("DB: ensureAdminForEmailMatch error:", error);
    return false;
  }
}

/**
 * Get all admin users with their details
 */
export async function getAllAdmins(): Promise<AdminUser[]> {
  try {
    const sql = await getSqlInstance();
    const result = await sql`
      SELECT
        ar.id,
        u.email,
        ar.role,
        ar.granted_by,
        ar.granted_at,
        ar.is_active,
        ar.created_at,
        ar.updated_at,
        granter.email as granted_by_email
      FROM admin_roles ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN users granter ON ar.granted_by = granter.id
      WHERE ar.is_active = true
      ORDER BY ar.granted_at DESC
    `;

    const rows = extractRows(result);
    return rows as AdminUser[];
  } catch (error) {
    console.error("DB: CONNECTION-FAIL: Error fetching admin users. This often indicates the PostgreSQL Docker container is not running. Please check that your database container is started:", error);
    return [];
  }
}

/**
 * Get admin user details by user ID
 */
export async function getAdminDetails(userId: string): Promise<AdminUser | null> {
  try {
    const sql = await getSqlInstance();
    const result = await sql`
      SELECT
        ar.id,
        u.email,
        ar.role,
        ar.granted_by,
        ar.granted_at,
        ar.is_active,
        ar.created_at,
        ar.updated_at,
        granter.email as granted_by_email
      FROM admin_roles ar
      JOIN users u ON ar.user_id = u.id
      LEFT JOIN users granter ON ar.granted_by = granter.id
      WHERE ar.user_id = ${userId}
      LIMIT 1
    `;

    const rows = extractRows(result);
    return rows.length > 0 ? (rows[0] as AdminUser) : null;
  } catch (error) {
    console.error("DB: CONNECTION-FAIL: Error fetching admin details. This often indicates the PostgreSQL Docker container is not running. Please check that your database container is started:", error);
    return null;
  }
}
