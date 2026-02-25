// Plan-related types
export interface UserPlanInfo {
  plan_name: string;
  joined_at: string;
}

export interface UserPlanDetails {
  userEmail: string;
  plan: {
    name: string;
    monthlyCredits: number;
    assignedAt: string | null;
    updatedAt: string | null;
  } | null;
  credits: {
    currentCredits: number;
    totalCreditsEarned: number;
    createdAt: string | null;
    updatedAt: string | null;
  };
}

export interface UserPlan {
  id: string;
  userEmail: string;
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

export interface LastActivePlan {
  planName: string;
  monthlyCredits: number;
  stripePriceId?: string;
}

