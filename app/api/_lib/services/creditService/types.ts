import type { ModelInfo } from "@/components/default/credits/utils/creditCalculator";

export type { DatabaseClient, DatabaseResult } from "../../db";

export type DatabaseRow = Record<string, unknown>;

// Metadata types
export interface InvoiceMetadata {
  invoiceId: string;
  amount: number;
  currency: string;
  description: string;
  attemptCount?: number;
  status?: string;
}

export interface ServiceUsageMetadata {
  fileSizeMb?: number;
  pageCount?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface TransactionMetadata extends Record<string, unknown> {
  invoiceId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  attemptCount?: number;
  status?: string;
  reason?: string;
  fileSizeMb?: number;
  pageCount?: number;
}

export interface UserPlan {
  id: string;
  userId: string;
  planName: string;
  monthlyCredits: number;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  stripeMonthlyPriceId?: string | null;
  stripeYearlyPriceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserCredits {
  id: string;
  userId: string;
  currentCredits: number;
  totalCreditsEarned: number;
  totalCreditsUsed: number;
  lastResetDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ServiceCost interface removed - deprecated functionality replaced by model-based pricing

export interface CreditTransaction {
  id: string;
  userId: string;
  transactionType: "usage" | "subscription" | "reset" | "bonus" | "refund";
  serviceName?: string;
  serviceCategory?: string;
  creditsUsed: number;
  creditsBefore: number;
  creditsAfter: number;
  actualPrice?: number;
  metadata?: TransactionMetadata;
  createdAt: Date;
}

// Model types are now defined in the credit calculator utility file

export interface ServiceUsageParams {
  userId: string;
  serviceName: string;
  fileSizeMb?: number;
  pageCount?: number;
  metadata?: ServiceUsageMetadata;
  // New model-based fields
  modelInfo?: ModelInfo;
  promptTokens?: number;
  completionTokens?: number;
  imageCount?: number;
  requestCount?: number;
}

// Statistics types
export interface CreditUsageData {
  date: string;
  credits: number;
  monetary_value: number;
  user_id?: string;
}

export interface ServiceBreakdown {
  service_name: string;
  service_category: string;
  total_credits: number;
  total_monetary_value: number;
  transaction_count: number;
}

export interface ModelUsage {
  model_id: string;
  model_name: string;
  provider: string;
  usage_count: number;
  total_credits: number;
  total_cost: number;
}
