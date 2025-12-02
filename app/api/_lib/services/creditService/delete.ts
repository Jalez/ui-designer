import { getSqlInstance } from "../../db/shared";

type CancelUserSubscriptionParams = {
  userId: string;
};
/**
 * Cancel user's subscription
 * Note: User keeps their current credits until billing period ends
 * Since we're using Stripe as single source of truth, we don't change plan assignments
 * The user will be downgraded to free tier when their subscription actually ends
 */
export async function cancelUserSubscription({ userId }: CancelUserSubscriptionParams): Promise<void> {
  const sql = await getSqlInstance();

  // Update subscription status to canceled
  // User keeps their current plan assignment and credits until billing period ends
  await sql.query(
    `UPDATE user_subscriptions
     SET subscription_status = 'canceled',
         cancel_at_period_end = true,
         updated_at = NOW()
     WHERE user_id = $1`,
    [userId],
  );

  // Note: We don't update user_plan_assignments here because:
  // 1. The user should keep their current plan benefits until the billing period ends
  // 2. Plan information now comes from Stripe, not our database
  // 3. Webhooks will handle the actual plan change when the subscription ends
}
