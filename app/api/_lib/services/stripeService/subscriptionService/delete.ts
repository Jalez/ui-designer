import { getSqlInstance, extractRows } from "../../../db/shared";
import { getStripeInstance, getFreePlanFromStripe } from "../shared";

/**
 * Cancel user's subscription
 */
export async function cancelUserSubscription(userEmail: string): Promise<void> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    // Get free plan from Stripe using shared function
    const freePlanData = await getFreePlanFromStripe();
    const freePlan = {
      plan_name: freePlanData.planName,
      monthly_credits: freePlanData.monthlyCredits
    };

    // Database updates removed - subscription cancellation handled entirely by Stripe
    // User will automatically be downgraded to free plan when subscription ends
    // No need to update local plan assignments since they're derived from Stripe
  } catch (error) {
    console.error("Error canceling user subscription:", error);
    throw error;
  }
}
