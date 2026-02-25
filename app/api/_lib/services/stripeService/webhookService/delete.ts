import type Stripe from "stripe";
import { getCreditService } from "../../creditService";
import { ensureUserInitializedByEmail } from "../../userService";
import { cancelUserSubscription } from "../subscriptionService";
import { getStripeInstance } from "../shared";

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripe = getStripeInstance();
  console.log("SERVER: WEBHOOK-SUBSCRIPTION-DELETED: Processing subscription deletion:", subscription.id);

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

    // Create baseline plan records if the user never initialized inside the app
    await ensureUserInitializedByEmail(userEmail);

    const creditService = getCreditService();

    // Cancel the subscription in our database
    await cancelUserSubscription(userEmail);

    console.log("SERVER: WEBHOOK-SUCCESS: Subscription cancelled for user:", userEmail);
  } catch (error) {
    console.error("SERVER: WEBHOOK-ERROR: Error handling subscription deleted:", error);
  }
}
