import { getPlanService } from "../../planService";
import { getMonthlyCredits, getPlanFeatures, getPlanName, getStripeInstance } from "../shared";
import type { Subscription } from "./types";

/**
 * Create a free subscription for a new or existing customer
 */
export async function createFreeSubscription(userEmail: string, customerId?: string): Promise<Subscription> {
  const stripe = getStripeInstance();
  const planService = getPlanService();

  const customer = await stripe.customers.create({
    email: userEmail,
    name: userEmail.split("@")[0], // Use email prefix as name
  });

  // Find the free plan (price = 0)
  const freePrices = await stripe.prices.list({
    active: true,
    type: "recurring",
  });

  const freePrice = freePrices.data.find((price) => price.unit_amount === 0);
  if (!freePrice) {
    throw new Error(
      "No free plan (price = $0) found in Stripe. Please create a free plan product with $0 monthly price.",
    );
  }

  const subscription = await stripe.subscriptions.create({
    customer: typeof customer === "object" && "id" in customer ? customer.id : customerId!,
    items: [{ price: freePrice.id }],
    metadata: { plan_type: "free" },
  });

  // Return the free subscription data
  const priceId = subscription.items.data[0]?.price.id;
  const [features, planName, monthlyCredits] = await Promise.all([
    getPlanFeatures(priceId, stripe),
    getPlanName(priceId, stripe),
    getMonthlyCredits(priceId, planService, stripe),
  ]);

  return {
    stripeCustomerId: subscription.customer as string,
    plan: priceId,
    status: subscription.status as "active" | "canceled" | "past_due" | "incomplete",
    currentPeriodEnd: subscription.items.data[0]?.current_period_end || null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    features,
    planName,
    monthlyCredits,
  };
}

/**
 * Create a paid subscription for a customer
 */
export async function createPaidSubscription(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>,
): Promise<Subscription> {
  const stripe = getStripeInstance();
  const planService = getPlanService();

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: metadata || {},
  });

  // Return the subscription data
  const subscriptionPriceId = subscription.items.data[0]?.price.id;
  const [features, planName, monthlyCredits] = await Promise.all([
    getPlanFeatures(subscriptionPriceId, stripe),
    getPlanName(subscriptionPriceId, stripe),
    getMonthlyCredits(subscriptionPriceId, planService, stripe),
  ]);

  return {
    stripeCustomerId: subscription.customer as string,
    plan: subscriptionPriceId,
    status: subscription.status as "active" | "canceled" | "past_due" | "incomplete",
    currentPeriodEnd: subscription.items.data[0]?.current_period_end || null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    features,
    planName,
    monthlyCredits,
  };
}
