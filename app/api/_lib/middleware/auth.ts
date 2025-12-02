import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NextRequest } from "next/server";

/**
 * Get the current session from NextAuth
 */
export async function getSession() {
  return await getServerSession(authOptions);
}

/**
 * Require authentication for an API route
 * Returns the session if authenticated, throws error otherwise
 */
export async function requireAuth() {
  const session = await getSession();
  
  if (!session || !session.user) {
    throw new Error("Unauthorized");
  }
  
  return session;
}

/**
 * Require admin role for an API route
 * Returns the session if user is admin, throws error otherwise
 */
export async function requireAdmin() {
  const session = await requireAuth();
  
  // Check if user is admin (you'll need to add this field to your user model)
  // @ts-ignore - admin field will be added to session user
  if (!session.user.isAdmin) {
    throw new Error("Forbidden - Admin access required");
  }
  
  return session;
}

/**
 * Check if user is authenticated (returns boolean without throwing)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}

/**
 * Check if user is admin (returns boolean without throwing)
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  // @ts-ignore - admin field will be added to session user
  return !!(session?.user?.isAdmin);
}

