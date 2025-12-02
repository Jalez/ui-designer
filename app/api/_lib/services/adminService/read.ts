import { extractRows, getSqlInstance } from "../../db/shared";
import type { AdminUser } from "./types";

/**
 * Check if a user is an admin
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
