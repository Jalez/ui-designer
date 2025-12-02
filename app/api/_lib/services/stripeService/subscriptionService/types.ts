export interface Subscription {
  stripeCustomerId: string;
  plan: string | null; // stripeMonthlyPriceId or null
  status: "active" | "canceled" | "past_due" | "incomplete";
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  features: string[];
  planName: string;
  monthlyCredits: number;
  pendingPlanChange?: {
    plan: string; // stripeMonthlyPriceId
    planName: string;
    effectiveDate: number;
    credits: number;
  };
}

export interface Invoice {
  id: string;
  number: string | null;
  status: string;
  amount: number;
  currency: string;
  date: number;
  description: string | null;
  downloadUrl: string | null;
  hostedUrl: string | null;
  periodStart: number;
  periodEnd: number;
  paid: boolean;
}

export interface UpdateSubscriptionData {
  planName?: string;
  monthlyCredits?: number;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  subscriptionStatus?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  stripeMonthlyPriceId?: string | null;
  stripeYearlyPriceId?: string | null;
}
