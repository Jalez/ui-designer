import { getSqlInstance, extractRows } from "../../../db/shared";
import type { UpdateSubscriptionData } from "./types";

/**
 * Update user's subscription information
 */
export async function updateUserSubscription(
  userEmail: string,
  subscriptionData: UpdateSubscriptionData,
): Promise<void> {
  // Database updates removed - all subscription data comes directly from Stripe
  // Webhooks can still trigger business logic like notifications, analytics, etc.

  console.log(`Subscription update for ${userEmail}:`, subscriptionData);
  // Add any business logic here that should run on subscription updates
  // (emails, analytics, feature toggles, etc.)
}
