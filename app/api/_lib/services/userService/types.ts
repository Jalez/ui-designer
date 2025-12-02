/**
 * User Service Types
 *
 * Types for user management operations
 */

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified?: Date;
  stripeCustomerId?: string; // Stripe customer ID for subscription queries
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  email_verified: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserWithDetails {
  user_id: string;
  email: string;
  name: string;
  stripe_customer_id: string | null; // Links to Stripe customer for subscription data
  current_credits: number;
  // Plan data removed - now queried from Stripe APIs on demand
  plan_name: string | null; // Always null - plan info via Stripe
  monthly_credits: number; // Always 0 - plan info via Stripe
  plan_assigned_at: Date | null; // Always null - plan info via Stripe
  is_admin: boolean;
  admin_role: string | null;
  created_at: Date | null;
}

export interface CreateUserOptions {
  email: string;
  name?: string;
  image?: string;
}

export interface UpdateUserOptions {
  name?: string;
  image?: string;
  emailVerified?: Date;
}

export interface AdminOperationResult {
  email: string;
  success: boolean;
}

export interface DeleteUserResult {
  email: string;
  deleted: boolean;
}
