import type Stripe from "stripe";
import { refreshUserCredits } from "../../creditService/update";
import { getPlanService } from "../../planService";
import { ensureUserInitializedByEmail } from "../../userService";
import { getMonthlyCredits, getPlanName, getStripeInstance } from "../shared";
import { updateUserSubscription } from "../subscriptionService";

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const stripe = getStripeInstance();
  console.log("SERVER: WEBHOOK-SUBSCRIPTION-UPDATED: Processing subscription update:", subscription.id);

  if (!subscription.customer) {
    console.error("SERVER: WEBHOOK-ERROR: No customer ID in subscription");
    return;
  }

  try {
    // Get customer details
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (customer.deleted || !("email" in customer) || !customer.email) {
      console.error("SERVER: WEBHOOK-ERROR: Customer not found or no email");
      return;
    }

    const userEmail = customer.email;

    // Ensure user records exist before attempting to refresh their plan
    const userId = await ensureUserInitializedByEmail(userEmail);

    const planService = getPlanService();

    // Get the price ID from the subscription
    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
      console.error("SERVER: WEBHOOK-ERROR: No price ID found in subscription");
      return;
    }

    // Get plan name and credits from Stripe metadata (following cursor rules)
    const planName = await getPlanName(priceId, stripe);
    const monthlyCredits = await getMonthlyCredits(priceId, planService, stripe);

    console.log("SERVER: WEBHOOK-INFO: Using Stripe metadata - Plan:", planName, "Credits:", monthlyCredits);

    // Update user subscription
    await updateUserSubscription(userEmail, {
      planName: planName,
      monthlyCredits: monthlyCredits,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      subscriptionStatus: subscription.status,
      currentPeriodStart: new Date((subscription.items.data[0]?.current_period_start || 0) * 1000),
      currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end || 0) * 1000),
    });

    // Refresh user credits to match the new plan allocation immediately
    await refreshUserCredits({ userId: userId });

    console.log("SERVER: WEBHOOK-SUCCESS: Subscription updated and credits refreshed for user:", userEmail);
  } catch (error) {
    console.error("SERVER: WEBHOOK-ERROR: Error handling subscription updated:", error);
  }
}
