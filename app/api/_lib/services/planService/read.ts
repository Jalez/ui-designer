import { extractRows, getSqlInstance } from "../../db/shared";
import { getStripeInstance } from "../stripeService";
import type { LastActivePlan, UserPlan, UserPlanDetails, UserPlanInfo } from "./types";

interface SubscriptionData {
  customerId: string;
  userEmail: string;
  subscriptions: any[];
  credits: UserPlanDetails["credits"];
}

type GetCompleteSubscriptionDataParams = {
  userId: string;
  userEmail: string;
};

/**
 * Helper function to fetch product data from Stripe
 */
async function getProductData(productId: string) {
  const stripe = getStripeInstance();
  try {
    const product = await stripe.products.retrieve(productId);
    return product;
  } catch (error) {
    console.error("Error fetching product data:", error);
    return null;
  }
}

/**
 * Core function to get all subscription and credits data in one go
 */
async function getCompleteSubscriptionData(userId: string, userEmail: string): Promise<SubscriptionData | null> {
  const sql = await getSqlInstance();

  // Get user's Stripe customer ID
  const userResult = await sql.query("SELECT stripe_customer_id FROM users WHERE id = $1", [userId]);
  const userRows = extractRows(userResult);

  if (userRows.length === 0 || !userRows[0].stripe_customer_id) {
    return null;
  }

  const customerId = userRows[0].stripe_customer_id;
  const stripe = getStripeInstance();

  // Get user credits from our database
  const creditsResult = await sql.query(
    `
    SELECT
      current_credits,
      total_credits_earned,
      created_at as credits_created_at,
      updated_at as credits_updated_at
    FROM user_credits
    WHERE user_id = $1
  `,
    [userId],
  );

  const creditsRows = extractRows(creditsResult) as Array<{
    current_credits: number;
    total_credits_earned: number;
    credits_created_at: string | null;
    credits_updated_at: string | null;
  }>;

  const credits =
    creditsRows.length > 0
      ? {
          currentCredits: Number(creditsRows[0].current_credits || 0),
          totalCreditsEarned: Number(creditsRows[0].total_credits_earned || 0),
          createdAt: creditsRows[0].credits_created_at,
          updatedAt: creditsRows[0].credits_updated_at,
        }
      : {
          currentCredits: 0,
          totalCreditsEarned: 0,
          createdAt: null,
          updatedAt: null,
        };

  try {
    // Get all subscriptions (for both current and historical data)
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10, // Enough for history
      expand: ["data.default_payment_method", "data.items.data.price"],
    });

    return {
      customerId,
      userEmail,
      subscriptions: subscriptions.data,
      credits,
    };
  } catch (error) {
    console.error("Error fetching subscription data from Stripe:", error);
    return null;
  }
}

/**
 * Get user's plan information for statistics - from Stripe subscription
 */
export async function getUserPlanInfo(userId: string): Promise<UserPlanInfo | null> {
  // We need to get user email for the complete data function
  const sql = await getSqlInstance();
  const userResult = await sql.query("SELECT email FROM users WHERE id = $1", [userId]);
  const userRows = extractRows(userResult);

  if (userRows.length === 0) {
    return null;
  }

  const data = await getCompleteSubscriptionData(userId, userRows[0].email);
  if (!data || data.subscriptions.length === 0) {
    return null; // No subscription history
  }

  const subscription = data.subscriptions[0];
  const productId = subscription.items.data[0]?.price?.product as string;
  const product = productId ? await getProductData(productId) : null;

  return {
    plan_name: product?.name || "Unknown Plan",
    joined_at: new Date((subscription as any).created * 1000).toISOString(),
  };
}

/**
 * Get comprehensive user plan details including credits - from Stripe + local credits
 */
export async function getUserPlanDetails(userEmail: string): Promise<UserPlanDetails> {
  // Get user ID for the complete data function
  const sql = await getSqlInstance();
  const userResult = await sql.query("SELECT id FROM users WHERE email = $1", [userEmail]);
  const userRows = extractRows(userResult);

  if (userRows.length === 0) {
    return {
      userEmail,
      plan: null,
      credits: {
        currentCredits: 0,
        totalCreditsEarned: 0,
        createdAt: null,
        updatedAt: null,
      },
    };
  }

  const data = await getCompleteSubscriptionData(userRows[0].id, userEmail);
  if (!data) {
    return {
      userEmail,
      plan: null,
      credits: {
        currentCredits: 0,
        totalCreditsEarned: 0,
        createdAt: null,
        updatedAt: null,
      },
    };
  }

  // Filter for active subscriptions only
  const activeSubscriptions = data.subscriptions.filter((sub) => sub.status === "active");

  if (activeSubscriptions.length === 0) {
    return {
      userEmail,
      plan: null, // No active subscription = free plan
      credits: data.credits,
    };
  }

  const subscription = activeSubscriptions[0];
  const productId = subscription.items.data[0]?.price?.product as string;
  const product = productId ? await getProductData(productId) : null;
  const monthlyCredits = product?.metadata?.credits ? Number(product.metadata.credits) : 50;

  return {
    userEmail,
    plan: {
      name: product?.name || "Unknown Plan",
      monthlyCredits,
      assignedAt: new Date(subscription.created * 1000).toISOString(),
      updatedAt: new Date(subscription.created * 1000).toISOString(),
    },
    credits: data.credits,
  };
}

/**
 * Get user's current plan with subscription details - from Stripe
 */
export async function getUserPlan(userId: string): Promise<UserPlan | null> {
  // Get user email for the complete data function
  const sql = await getSqlInstance();
  const userResult = await sql.query("SELECT email FROM users WHERE id = $1", [userId]);
  const userRows = extractRows(userResult);

  if (userRows.length === 0) {
    return null;
  }

  const data = await getCompleteSubscriptionData(userId, userRows[0].email);
  if (!data) {
    return null;
  }

  // Filter for active subscriptions only
  const activeSubscriptions = data.subscriptions.filter((sub) => sub.status === "active");

  if (activeSubscriptions.length === 0) {
    return null; // No active subscription
  }

  const subscription = activeSubscriptions[0];
  const price = subscription.items.data[0]?.price;
  const productId = price?.product as string;
  const product = productId ? await getProductData(productId) : null;

  const monthlyCredits = product?.metadata?.credits ? Number(product.metadata.credits) : 50;

  return {
    id: subscription.id,
    userEmail: data.userEmail,
    planName: product?.name || "Unknown Plan",
    monthlyCredits,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: data.customerId,
    subscriptionStatus: subscription.status,
    currentPeriodStart: new Date((subscription as any).current_period_start * 1000),
    currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
    stripeMonthlyPriceId: price?.id,
    stripeYearlyPriceId: null, // Could determine from price
    createdAt: new Date(subscription.created * 1000),
    updatedAt: new Date(subscription.created * 1000),
  };
}

/**
 * Get user's last active plan from Stripe subscription history
 */
export async function getLastActivePlan(userEmail: string): Promise<LastActivePlan | null> {
  // Get user ID for the complete data function
  const sql = await getSqlInstance();
  const userResult = await sql.query("SELECT id FROM users WHERE email = $1", [userEmail]);
  const userRows = extractRows(userResult);

  if (userRows.length === 0) {
    return null;
  }

  const data = await getCompleteSubscriptionData(userRows[0].id, userEmail);
  if (!data || data.subscriptions.length === 0) {
    return null;
  }

  // Find the most recently ended subscription (or current if active)
  const sortedSubs = data.subscriptions.sort(
    (a, b) =>
      ((b as any).ended_at || (b as any).current_period_end) - ((a as any).ended_at || (a as any).current_period_end),
  );

  const lastSubscription = sortedSubs[0];
  const price = lastSubscription.items.data[0]?.price;
  const productId = price?.product as string;
  const product = productId ? await getProductData(productId) : null;

  const monthlyCredits = product?.metadata?.credits ? Number(product.metadata.credits) : 50;

  return {
    planName: product?.name || "Unknown Plan",
    monthlyCredits,
    stripePriceId: price?.id || lastSubscription.items.data[0]?.price.id,
  };
}

/**
 * Get users subscribed to a specific plan (by stripe price ID) - from Stripe
 */
export async function getUsersByPlan(stripeMonthlyPriceId: string): Promise<string[]> {
  const sql = await getSqlInstance();
  const stripe = getStripeInstance();

  try {
    // Get all active subscriptions with this price ID
    const subscriptions = await stripe.subscriptions.list({
      price: stripeMonthlyPriceId,
      status: "active",
      expand: ["data.customer"],
      limit: 100, // Adjust as needed
    });

    const userEmails: string[] = [];

    for (const subscription of subscriptions.data) {
      const customer = subscription.customer as any;
      if (customer?.email) {
        userEmails.push(customer.email);
      }
    }

    return userEmails;
  } catch (error) {
    console.error("Error fetching users by plan from Stripe:", error);
    return [];
  }
}

/**
 * Get user's storage limit in bytes from Stripe product metadata
 * Returns the storage limit based on their active subscription plan
 * Defaults to 100MB (104857600 bytes) for free tier users
 */
export async function getUserStorageLimit(userId: string): Promise<number> {
  const DEFAULT_STORAGE_LIMIT = 100 * 1024 * 1024; // 100 MB in bytes

  try {
    // Get user email for the complete data function
    const sql = await getSqlInstance();
    const userResult = await sql.query("SELECT email FROM users WHERE id = $1", [userId]);
    const userRows = extractRows(userResult);

    if (userRows.length === 0) {
      return DEFAULT_STORAGE_LIMIT;
    }

    const data = await getCompleteSubscriptionData(userId, userRows[0].email);
    if (!data) {
      return DEFAULT_STORAGE_LIMIT;
    }

    // Filter for active subscriptions only
    const activeSubscriptions = data.subscriptions.filter((sub) => sub.status === "active");

    if (activeSubscriptions.length === 0) {
      // No active subscription = free tier, return default
      return DEFAULT_STORAGE_LIMIT;
    }

    const subscription = activeSubscriptions[0];
    const price = subscription.items.data[0]?.price;
    const productId = price?.product as string;
    const product = productId ? await getProductData(productId) : null;

    if (!product) {
      return DEFAULT_STORAGE_LIMIT;
    }

    // Extract storage_limit_bytes from product metadata
    const storageLimitBytes = product.metadata?.storage_limit_bytes
      ? Number(product.metadata.storage_limit_bytes)
      : null;

    // Return the limit if set, otherwise default
    return storageLimitBytes && storageLimitBytes > 0 ? storageLimitBytes : DEFAULT_STORAGE_LIMIT;
  } catch (error) {
    console.error("Error fetching user storage limit:", error);
    return DEFAULT_STORAGE_LIMIT;
  }
}
