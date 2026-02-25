import { getSqlInstance } from "../../db/shared";

/**
 * Remove admin privileges from a user
 */
export async function removeAdmin(userId: string): Promise<boolean> {
  try {
    const sql = await getSqlInstance();
    await sql`
      UPDATE admin_roles
      SET is_active = false, updated_at = NOW()
      WHERE user_id = ${userId}
    `;

    return true;
  } catch (error) {
    console.error("Error removing admin user:", error);
    return false;
  }
}
