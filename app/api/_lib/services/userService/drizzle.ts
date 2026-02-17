import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, adminRoles, userCredits } from "@/lib/db/schema";
import type { User, UserWithDetails, UpdateUserOptions, AdminOperationResult, DeleteUserResult } from "./types";

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    image: row.image ?? undefined,
    emailVerified: row.emailVerified ?? undefined,
    stripeCustomerId: row.stripeCustomerId ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getUserById(userId: string): Promise<User | null> {
  const db = getDb();
  
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return mapUser(result[0]);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return mapUser(result[0]);
}

export async function getUserEmail(userId: string): Promise<string | null> {
  const db = getDb();
  
  const result = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  
  return result.length > 0 ? result[0].email : null;
}

export async function getAllUsers(): Promise<UserWithDetails[]> {
  const db = getDb();
  
  const result = await db
    .select({
      user_id: users.id,
      email: users.email,
      name: users.name,
      stripe_customer_id: users.stripeCustomerId,
      created_at: users.createdAt,
      current_credits: userCredits.currentCredits,
      is_admin: adminRoles.userId,
      admin_role: adminRoles.role,
    })
    .from(users)
    .leftJoin(userCredits, eq(users.id, userCredits.userId))
    .leftJoin(adminRoles, and(eq(users.id, adminRoles.userId), eq(adminRoles.isActive, true)));
  
  return result.map((row) => ({
    user_id: row.user_id,
    email: row.email,
    name: row.name ?? row.email,
    stripe_customer_id: row.stripe_customer_id ?? null,
    current_credits: Number(row.current_credits) || 0,
    plan_name: null,
    monthly_credits: 0,
    plan_assigned_at: null,
    is_admin: row.is_admin !== null,
    admin_role: row.admin_role ?? null,
    created_at: row.created_at ?? null,
  }));
}

export async function getOrCreateUserByEmail(email: string): Promise<User> {
  const db = getDb();
  
  const existing = await getUserByEmail(email);
  if (existing) {
    return existing;
  }
  
  const result = await db.insert(users).values({ email }).returning();
  
  if (result.length === 0) {
    throw new Error("Failed to create user");
  }
  
  return mapUser(result[0]);
}

export async function updateUserProfile(userId: string, updates: UpdateUserOptions): Promise<User> {
  const db = getDb();
  
  const updateData: Record<string, unknown> = {};
  
  if (updates.name !== undefined) {
    updateData.name = updates.name;
  }
  if (updates.image !== undefined) {
    updateData.image = updates.image;
  }
  if (updates.emailVerified !== undefined) {
    updateData.emailVerified = updates.emailVerified;
  }
  
  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update");
  }
  
  const result = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
  
  if (result.length === 0) {
    throw new Error("User not found");
  }
  
  return mapUser(result[0]);
}

export async function updateUserStripeCustomerId(userEmail: string, stripeCustomerId: string): Promise<void> {
  const db = getDb();
  
  await db.update(users)
    .set({ stripeCustomerId })
    .where(eq(users.email, userEmail));
}

export async function promoteUserToAdmin(userId: string): Promise<AdminOperationResult> {
  const db = getDb();
  
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  await db.insert(adminRoles).values({ userId, role: "admin" }).onConflictDoNothing();
  
  return { email: user.email, success: true };
}

export async function demoteUserFromAdmin(userId: string): Promise<AdminOperationResult> {
  const db = getDb();
  
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  await db.delete(adminRoles).where(eq(adminRoles.userId, userId));
  
  return { email: user.email, success: true };
}

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  const db = getDb();
  
  const user = await getUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  
  await db.delete(adminRoles).where(eq(adminRoles.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  
  return { email: user.email, deleted: true };
}
