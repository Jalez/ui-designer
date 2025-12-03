import type { PricingPlan } from "../../components/Plan/PlanContext";

export interface CreateCheckoutSessionData {
  priceId: string;
  planId: string;
}

export interface CheckoutSessionResult {
  checkoutUrl?: string;
  url?: string;
  isPortal?: boolean;
  portalOpenedAt?: number;
  error?: string;
  details?: string;
}

/**
 * Create a Stripe customer portal session
 * Returns the portal URL
 */
export async function createPortalSession(): Promise<string> {
  const response = await fetch("/api/stripe/portal", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to create portal session");
  }

  const { url } = await response.json();
  return url;
}

/**
 * Get the appropriate Stripe price ID for a plan based on billing period
 */
export function getPriceId(plan: PricingPlan, isYearly: boolean = false): string {
  return isYearly ? plan.stripeYearlyPriceId || plan.stripeMonthlyPriceId : plan.stripeMonthlyPriceId;
}

/**
 * Create a Stripe checkout session for purchasing a plan
 */
export async function createCheckoutSession(priceId: string, planId: string): Promise<CheckoutSessionResult> {
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      priceId,
      plan: planId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create checkout session");
  }

  return await response.json();
}
