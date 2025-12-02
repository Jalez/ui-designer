import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { DeleteUserResult } from "./types";

/**
 * Delete a user completely from the system
 * This removes all user data and related records
 */
export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const sqlInstance = await sql();

  // Start a transaction to ensure all related data is deleted atomically
  await sqlInstance.query("BEGIN");

  try {
    // Get user email for the response message before deletion
    const userResult = await sqlInstance`SELECT email FROM users WHERE id = ${userId}`;
    const userRows = extractRows(userResult);
    const userEmail = userRows[0]?.email;

    if (!userEmail) {
      throw new Error("User not found");
    }

    // Delete in reverse dependency order (cascading deletes will handle most relationships)
    // Admin roles first (since they reference users)
    await sqlInstance`DELETE FROM admin_roles WHERE user_id = ${userId}`;

    // The users table deletion will cascade to related tables due to foreign key constraints
    await sqlInstance`DELETE FROM users WHERE id = ${userId}`;

    await sqlInstance.query("COMMIT");

    return { email: userEmail, deleted: true };
  } catch (error) {
    await sqlInstance.query("ROLLBACK");
    console.error("Error in deleteUser:", error);
    throw new Error("Failed to delete user");
  }
}
