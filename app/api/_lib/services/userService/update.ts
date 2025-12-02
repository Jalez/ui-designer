import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { AdminOperationResult, UpdateUserOptions, User } from "./types";

/**
 * Update user profile information
 */
export async function updateUserProfile(userId: string, updates: UpdateUserOptions): Promise<User> {
  const setParts = [];
  const values = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    setParts.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }

  if (updates.image !== undefined) {
    setParts.push(`image = $${paramIndex++}`);
    values.push(updates.image);
  }

  if (updates.emailVerified !== undefined) {
    setParts.push(`email_verified = $${paramIndex++}`);
    values.push(updates.emailVerified);
  }

  if (setParts.length === 0) {
    throw new Error("No fields to update");
  }

  setParts.push(`updated_at = $${paramIndex++}`);
  values.push(new Date());

  const query = `
    UPDATE users
    SET ${setParts.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING id, email, name, image, email_verified, created_at, updated_at
  `;
  values.push(userId);

  const sqlInstance = await sql();
  const updatedUser = await sqlInstance.unsafe(query, values);
  const updatedUserRows = extractRows(updatedUser);

  if (updatedUserRows.length === 0) {
    throw new Error("User not found");
  }

  return {
    id: updatedUserRows[0].id,
    email: updatedUserRows[0].email,
    name: updatedUserRows[0].name,
    image: updatedUserRows[0].image,
    emailVerified: updatedUserRows[0].email_verified,
    createdAt: updatedUserRows[0].created_at,
    updatedAt: updatedUserRows[0].updated_at,
  };
}

/**
 * Update user's Stripe customer ID
 */
export async function updateUserStripeCustomerId(userEmail: string, stripeCustomerId: string): Promise<void> {
  const sqlInstance = await sql();

  await sqlInstance`
    UPDATE users
    SET stripe_customer_id = ${stripeCustomerId}, updated_at = NOW() AT TIME ZONE 'UTC'
    WHERE email = ${userEmail}
  `;
}

/**
 * Promote a user to admin role
 */
export async function promoteUserToAdmin(userId: string): Promise<AdminOperationResult> {
  const sqlInstance = await sql();

  // First get the user email for the response
  const userResult = await sqlInstance`SELECT email FROM users WHERE id = ${userId}`;
  const userRows = extractRows(userResult);
  const userEmail = userRows[0]?.email;

  if (!userEmail) {
    throw new Error("User not found");
  }

  // Add user to admin_roles table
  await sqlInstance`INSERT INTO admin_roles (user_id, role) VALUES (${userId}, 'admin') ON CONFLICT (user_id) DO NOTHING`;

  return { email: userEmail, success: true };
}

/**
 * Demote a user from admin role
 */
export async function demoteUserFromAdmin(userId: string): Promise<AdminOperationResult> {
  const sqlInstance = await sql();

  // First get the user email for the response
  const userResult = await sqlInstance`SELECT email FROM users WHERE id = ${userId}`;
  const userRows = extractRows(userResult);
  const userEmail = userRows[0]?.email;

  if (!userEmail) {
    throw new Error("User not found");
  }

  // Remove user from admin_roles table
  await sqlInstance`DELETE FROM admin_roles WHERE user_id = ${userId}`;

  return { email: userEmail, success: true };
}
