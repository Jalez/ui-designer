import type { CreditTransaction, DatabaseRow, TransactionMetadata, UserCredits, UserPlan } from "./types";

// Re-export types from types.ts
export type {
  CreditTransaction,
  DatabaseClient,
  DatabaseResult,
  DatabaseRow,
  InvoiceMetadata,
  ServiceUsageMetadata,
  ServiceUsageParams,
  TransactionMetadata,
  UserCredits,
  UserPlan,
} from "./types";

// Helper function to get service category
export function getServiceCategory(serviceName: string): string {
  // Map service names to categories
  const categoryMap: Record<string, string> = {
    text_completion: "ai_generation",
    image_generation: "ai_generation",
    ai_image_generation: "ai_generation",
    ai_text_generation: "ai_generation",
    ai_completion: "ai_generation",
    document_export: "document",
    document_import: "document",
    storage: "storage",
    api_access: "api",
  };

  return categoryMap[serviceName] || "other";
}

// Helper methods for mapping database rows to objects

export function mapUserCreditsRow(row: {
  id: string;
  user_id: string;
  current_credits: number;
  total_credits_earned: number;
  total_credits_used: number;
  last_reset_date: string | Date;
  created_at: string | Date;
  updated_at: string | Date;
}): UserCredits {
  return {
    id: row.id,
    userId: row.user_id,
    currentCredits: row.current_credits,
    totalCreditsEarned: row.total_credits_earned,
    totalCreditsUsed: row.total_credits_used,
    lastResetDate: new Date(row.last_reset_date),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapUserPlanRow(row: {
  id: string;
  user_id: string;
  plan_name: string;
  monthly_credits: number;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  subscription_status?: string | null;
  current_period_start?: string | Date | null;
  current_period_end?: string | Date | null;
  stripe_monthly_price_id?: string | null;
  stripe_yearly_price_id?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}): UserPlan {
  return {
    id: row.id,
    userId: row.user_id,
    planName: row.plan_name,
    monthlyCredits: row.monthly_credits,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripeCustomerId: row.stripe_customer_id,
    subscriptionStatus: row.subscription_status ?? null,
    currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : null,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
    stripeMonthlyPriceId: row.stripe_monthly_price_id ?? null,
    stripeYearlyPriceId: row.stripe_yearly_price_id ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapCreditTransactionRow(
  row: DatabaseRow & {
    id: string;
    user_id: string;
    transaction_type: string;
    service_name: string | null;
    service_category: string | null;
    credits_used: number;
    credits_before: number;
    credits_after: number;
    actual_price: number | null;
    metadata: TransactionMetadata | null;
    created_at: string | Date;
  },
): CreditTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    transactionType: row.transaction_type as "usage" | "subscription" | "reset" | "bonus" | "refund",
    serviceName: row.service_name,
    serviceCategory: row.service_category,
    creditsUsed: row.credits_used,
    creditsBefore: row.credits_before,
    creditsAfter: row.credits_after,
    actualPrice: row.actual_price ? parseFloat(row.actual_price.toString()) : undefined,
    metadata: row.metadata || undefined,
    createdAt: new Date(row.created_at),
  };
}
