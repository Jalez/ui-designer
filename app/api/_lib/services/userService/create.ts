import { sql } from "@/app/api/_lib/db";
import { extractRows } from "../../db/shared";
import type { User, CreateUserOptions } from "./types";

/**
 * Get or create a user by email
 * This is the primary function for user identification
 */
export async function getOrCreateUserByEmail(email: string): Promise<User> {
  const sqlInstance = await sql();

  // Try to find existing user
  const existingUsers = await sqlInstance`
    SELECT id, email, name, image, email_verified, created_at, updated_at
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;

  const existingUsersRows = extractRows(existingUsers);

  if (existingUsersRows.length === 1) {
    return {
      id: existingUsersRows[0].id,
      email: existingUsersRows[0].email,
      name: existingUsersRows[0].name,
      image: existingUsersRows[0].image,
      emailVerified: existingUsersRows[0].email_verified,
      createdAt: existingUsersRows[0].created_at,
      updatedAt: existingUsersRows[0].updated_at,
    };
  }

  // Create new user
  const newUsers = await sqlInstance`
    INSERT INTO users (email)
    VALUES (${email})
    RETURNING id, email, name, image, email_verified, created_at, updated_at
  `;

  const newUsersRows = extractRows(newUsers);

  if (newUsersRows.length > 0) {
    return {
      id: newUsersRows[0].id,
      email: newUsersRows[0].email,
      name: newUsersRows[0].name,
      image: newUsersRows[0].image,
      emailVerified: newUsersRows[0].email_verified,
      createdAt: newUsersRows[0].created_at,
      updatedAt: newUsersRows[0].updated_at,
    };
  }

  throw new Error("Failed to create user");
}
