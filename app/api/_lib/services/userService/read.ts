import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { User, UserWithDetails } from "./types";

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const sqlInstance = await sql();
  const users = await sqlInstance`
    SELECT id, email, name, image, email_verified, stripe_customer_id, created_at, updated_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  const usersRows = extractRows(users);

  if (usersRows.length === 0) {
    return null;
  }

  return {
    id: usersRows[0].id,
    email: usersRows[0].email,
    name: usersRows[0].name,
    image: usersRows[0].image,
    emailVerified: usersRows[0].email_verified,
    stripeCustomerId: usersRows[0].stripe_customer_id,
    createdAt: usersRows[0].created_at,
    updatedAt: usersRows[0].updated_at,
  };
}

/**
 * Get user email by ID
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const sqlInstance = await sql();
  const users = await sqlInstance`
    SELECT email
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  const usersRows = extractRows(users);
  return usersRows.length > 0 ? usersRows[0].email : null;
}

/**
 * Get all users with their plan and credit information (admin view)
 */
export async function getAllUsers(): Promise<UserWithDetails[]> {
  const sqlInstance = await sql();

  const usersQuery = `
    SELECT
      u.id as user_id,
      u.email,
      u.name,
      u.stripe_customer_id,
      u.created_at,
      uc.current_credits,
      CASE WHEN ar.user_id IS NOT NULL THEN true ELSE false END as is_admin,
      ar.role as admin_role
    FROM users u
    LEFT JOIN user_credits uc ON u.id = uc.user_id
    LEFT JOIN admin_roles ar ON u.id = ar.user_id AND ar.is_active = true
    ORDER BY u.created_at DESC
  `;

  const usersResult = await sqlInstance.query(usersQuery);
  const users = extractRows(usersResult);

  return users.map((user: any) => ({
    user_id: user.user_id,
    email: user.email,
    name: user.name || user.email,
    stripe_customer_id: user.stripe_customer_id || null,
    current_credits: Number(user.current_credits) || 0,
    // Plan data removed - now queried from Stripe on demand
    plan_name: null, // Plan info available via Stripe APIs
    monthly_credits: 0, // Plan info available via Stripe APIs
    plan_assigned_at: null, // Plan info available via Stripe APIs
    is_admin: user.is_admin || false,
    admin_role: user.admin_role || null,
    created_at: user.created_at || null,
  }));
}
