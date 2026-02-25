import { randomUUID } from "node:crypto";
import { extractRows, getSqlInstance } from "../../db/shared";

/**
 * Add a user as admin
 */
export async function addAdmin(userId: string, role?: string, grantedByUserId?: string): Promise<boolean> {
  try {
    const sql = await getSqlInstance();

    // Check if user is already an admin
    const existingAdmin = await sql`
      SELECT id, is_active FROM admin_roles
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    const existingRows = extractRows(existingAdmin);
    if (existingRows.length > 0) {
      // If they exist but are inactive, reactivate them
      const adminRecord = existingRows[0] as { is_active: boolean };
      if (!adminRecord.is_active) {
        await sql`
          UPDATE admin_roles
          SET is_active = true, granted_by = ${grantedByUserId}, granted_at = NOW(), updated_at = NOW()
          WHERE user_id = ${userId}
        `;
      }
      return true;
    }

    // Add new admin role
    await sql`
      INSERT INTO admin_roles (id, user_id, role, granted_by)
      VALUES (${randomUUID()}, ${userId}, ${role || "admin"}, ${grantedByUserId || null})
    `;

    return true;
  } catch (error) {
    console.error("Error adding admin user:", error);
    return false;
  }
}
