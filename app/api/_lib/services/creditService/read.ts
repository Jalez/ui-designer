import { extractRows, getSqlInstance } from "../../db/shared";
import { mapCreditTransactionRow, mapUserCreditsRow, mapUserPlanRow } from "./shared";
import type { CreditTransaction, CreditUsageData, ModelUsage, ServiceBreakdown, UserCredits, UserPlan } from "./types";

type GetTransactionsParams = {
  userId?: string;
};

/**
 * Get transaction history for a user
 */
export async function getTransactions({ userId }: GetTransactionsParams): Promise<CreditTransaction[]> {
  const sql = await getSqlInstance();
  try {
    const query = userId
      ? `SELECT id, user_id, transaction_type, service_name, service_category, credits_used, credits_before, credits_after, actual_price, metadata, created_at
         FROM credit_transactions WHERE user_id = $1 ORDER BY created_at DESC`
      : `SELECT id, user_id, transaction_type, service_name, service_category, credits_used, credits_before, credits_after, actual_price, metadata, created_at
         FROM credit_transactions ORDER BY created_at DESC`;

    const result = await sql.query(query, userId ? [userId] : []);

    const rows = extractRows(result);

    return rows.map((row: any) => ({
      id: row.id as string,
      userId: row.user_id as string,
      transactionType: row.transaction_type as "usage" | "subscription" | "reset" | "bonus" | "refund",
      serviceName: row.service_name as string,
      serviceCategory: row.service_category as string,
      creditsUsed: row.credits_used as number,
      creditsBefore: row.credits_before as number,
      creditsAfter: row.credits_after as number,
      actualPrice: row.actual_price as number,
      metadata: row.metadata as any,
      createdAt: new Date(row.created_at as string | number | Date),
    }));
  } catch (error) {
    console.error("Error fetching credit transactions:", error);
    return [];
  }
}

type GetUserCreditsParams = {
  userId: string;
};

/**
 * Get user's current credit balance
 */
export async function getUserCredits({ userId }: GetUserCreditsParams): Promise<UserCredits | null> {
  const sql = await getSqlInstance();

  // First get the user's email from the users table
  const userResult = await sql.query("SELECT email FROM users WHERE id = $1", [userId]);
  const userRows = extractRows(userResult);

  if (userRows.length === 0) {
    return null;
  }

  // Then get credits by email
  const creditsResult = await sql.query("SELECT * FROM user_credits WHERE user_id = $1", [userId]);
  const creditsRows = extractRows(creditsResult);

  if (creditsRows.length === 0) {
    return null;
  }

  return mapUserCreditsRow(creditsRows[0] as any);
}

/**
 * Get the user's last active plan from Stripe subscription history (for resubscription UX)
 */
export async function getLastActivePlan(
  userEmail: string,
): Promise<{ planName: string; monthlyCredits: number; stripePriceId?: string } | null> {
  try {
    const { getStripeInstance, getPlanName, getMonthlyCredits } = await import("../stripeService/shared");
    const stripe = getStripeInstance();

    // Find customer by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return null;
    }

    const customer = customers.data[0];

    // Get all subscriptions (including canceled ones)
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 10, // Get recent subscriptions
    });

    // Find the most recent non-active subscription (canceled or past_due)
    const pastSubscriptions = subscriptions.data
      .filter((sub) => sub.status !== "active")
      .sort((a, b) => (b.canceled_at || b.created) - (a.canceled_at || a.created));

    if (pastSubscriptions.length === 0) {
      return null;
    }

    const lastSubscription = pastSubscriptions[0];
    const priceId = lastSubscription.items.data[0]?.price.id;

    if (!priceId) {
      return null;
    }

    // Get plan details from Stripe
    const [planName, monthlyCredits] = await Promise.all([
      getPlanName(priceId, stripe),
      getMonthlyCredits(priceId, null, stripe), // planService not needed anymore
    ]);

    return {
      planName,
      monthlyCredits,
      stripePriceId: priceId,
    };
  } catch (error) {
    console.error("Error fetching last active plan from Stripe:", error);
    return null;
  }
}

type HasEnoughCreditsParams = {
  userId: string;
  requiredCredits: number;
};
/**
 * Check if user has enough credits for a service
 */
export async function hasEnoughCredits({ userId, requiredCredits }: HasEnoughCreditsParams): Promise<boolean> {
  const userCredits = await getUserCredits({ userId });
  if (!userCredits) {
    return false;
  }

  return userCredits.currentCredits >= requiredCredits;
}

type GetCreditHistoryParams = {
  userId: string;
  limit: number;
  offset: number;
};

/**
 * Get user's credit transaction history
 */
export async function getCreditHistory({
  userId,
  limit,
  offset,
}: GetCreditHistoryParams): Promise<CreditTransaction[]> {
  const sql = await getSqlInstance();
  const result = await sql.query(
    `SELECT * FROM credit_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  const rows = extractRows(result);

  return rows.map((row) => mapCreditTransactionRow(row as any));
}

/**
 * Get users currently subscribed to a specific plan (for admin checks)
 */
export async function getUsersByPlan(stripeMonthlyPriceId: string): Promise<string[]> {
  try {
    const { getStripeInstance } = await import("../stripeService/shared");
    const stripe = getStripeInstance();

    // Get all active subscriptions with this price ID
    const subscriptions = await stripe.subscriptions.list({
      price: stripeMonthlyPriceId,
      status: "active",
      expand: ["data.customer"],
      limit: 100, // Adjust limit as needed
    });

    const userEmails: string[] = [];

    for (const subscription of subscriptions.data) {
      const customer = subscription.customer;
      if (customer && typeof customer === "object" && "email" in customer && customer.email) {
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
 * Get all service costs (for admin panel) - DEPRECATED
 */
export async function getAllServiceCosts(): Promise<never> {
  throw new Error("Service costs functionality has been deprecated and replaced by model-based pricing");
}

/**
 * Get credit usage data over time with missing dates filled
 */
export async function getCreditUsageData(userId: string, days: number): Promise<CreditUsageData[]> {
  const sql = await getSqlInstance();

  // Calculate the date threshold in UTC
  const now = new Date();
  const utcDateThreshold = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));

  // Get credit usage over time
  const creditUsageQuery = `
    SELECT
      LEFT(created_at::text, 10) as date,
      SUM(credits_used) as credits,
      SUM(CASE WHEN actual_price IS NOT NULL THEN actual_price ELSE 0 END) as monetary_value
    FROM credit_transactions
    WHERE created_at >= $1
      AND transaction_type = 'usage'
      AND user_id = $2
    GROUP BY LEFT(created_at::text, 10)
    ORDER BY date ASC
  `;

  const usageResult = await sql.query(creditUsageQuery, [utcDateThreshold.toISOString(), userId]);
  const usageData: CreditUsageData[] = extractRows(usageResult) as CreditUsageData[];

  // Fill in missing dates with zero credits
  const filledData: CreditUsageData[] = [];
  const startDateUTC = new Date(utcDateThreshold);
  const endDateUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const currentDate = new Date(startDateUTC);
  while (currentDate <= endDateUTC) {
    const dateStr = currentDate.toISOString().split("T")[0];

    const existing = usageData.find((item) => {
      let itemDate: string;
      if ((item.date as unknown) instanceof Date) {
        const dateObj = item.date as unknown as Date;
        itemDate = dateObj.toISOString().split("T")[0];
      } else if (typeof item.date === "string" && item.date.includes("T")) {
        itemDate = item.date.split("T")[0];
      } else if (typeof item.date === "string") {
        itemDate = item.date;
      } else {
        itemDate = String(item.date);
      }
      return itemDate === dateStr;
    });

    filledData.push({
      date: dateStr,
      credits: existing ? existing.credits || 0 : 0,
      monetary_value: existing ? existing.monetary_value || 0 : 0,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return filledData;
}

/**
 * Get service usage breakdown for a user
 */
export async function getServiceBreakdown(userId: string, dateThreshold: Date): Promise<ServiceBreakdown[]> {
  const sql = await getSqlInstance();

  const serviceBreakdownQuery = `
    SELECT
      service_name,
      MAX(COALESCE(service_category, 'other')) as service_category,
      SUM(credits_used) as total_credits,
      SUM(CASE WHEN actual_price IS NOT NULL THEN actual_price ELSE 0 END) as total_monetary_value,
      COUNT(*) as transaction_count
    FROM credit_transactions
    WHERE created_at >= $1
      AND transaction_type = 'usage'
      AND service_name IS NOT NULL
      AND user_id = $2
    GROUP BY service_name
    ORDER BY total_credits DESC
  `;

  const serviceBreakdownResult = await sql.query(serviceBreakdownQuery, [dateThreshold.toISOString(), userId]);
  return extractRows(serviceBreakdownResult) as ServiceBreakdown[];
}

type GetAllCreditUsageDataParams = {
  days: number;
  userId?: string;
};
/**
 * Get credit usage data for all users (admin analytics)
 */
export async function getAllCreditUsageData({ days, userId }: GetAllCreditUsageDataParams): Promise<CreditUsageData[]> {
  const sql = await getSqlInstance();

  // Calculate the date threshold in UTC
  const now = new Date();
  const utcDateThreshold = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));

  // Get credit usage over time
  let query = `
    SELECT
      LEFT(created_at::text, 10) as date,
      SUM(credits_used) as credits,
      SUM(CASE WHEN actual_price IS NOT NULL THEN actual_price ELSE 0 END) as monetary_value
    FROM credit_transactions
    WHERE created_at >= $1
      AND transaction_type = 'usage'`;

  const queryParams: any[] = [utcDateThreshold.toISOString()];

  if (userId) {
    query += " AND user_id = $2";
    queryParams.push(userId);
  }

  query += " GROUP BY LEFT(created_at::text, 10) ORDER BY date ASC";

  const usageResult = await sql.query(query, queryParams);
  const usageData: CreditUsageData[] = extractRows(usageResult) as CreditUsageData[];

  // Fill in missing dates with zero credits
  const filledData: CreditUsageData[] = [];
  const startDateUTC = new Date(utcDateThreshold);
  const endDateUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const currentDate = new Date(startDateUTC);
  while (currentDate <= endDateUTC) {
    const dateStr = currentDate.toISOString().split("T")[0];

    const existing = usageData.find((item) => {
      let itemDate: string;
      if ((item.date as unknown) instanceof Date) {
        const dateObj = item.date as unknown as Date;
        itemDate = dateObj.toISOString().split("T")[0];
      } else if (typeof item.date === "string" && item.date.includes("T")) {
        itemDate = item.date.split("T")[0];
      } else if (typeof item.date === "string") {
        itemDate = item.date;
      } else {
        itemDate = String(item.date);
      }
      return itemDate === dateStr;
    });

    filledData.push({
      date: dateStr,
      credits: existing ? existing.credits || 0 : 0,
      monetary_value: existing ? existing.monetary_value || 0 : 0,
      user_id: userId || undefined,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return filledData;
}

type GetAllServiceBreakdownParams = {
  dateThreshold: Date;
  userId?: string;
};
/**
 * Get service usage breakdown for all users (admin analytics)
 */
export async function getAllServiceBreakdown({
  dateThreshold,
  userId,
}: GetAllServiceBreakdownParams): Promise<ServiceBreakdown[]> {
  const sql = await getSqlInstance();

  let serviceBreakdownQuery = `
    SELECT
      service_name,
      MAX(COALESCE(service_category, 'other')) as service_category,
      SUM(credits_used) as total_credits,
      SUM(CASE WHEN actual_price IS NOT NULL THEN actual_price ELSE 0 END) as total_monetary_value,
      COUNT(*) as transaction_count
    FROM credit_transactions
    WHERE created_at >= $1
      AND transaction_type = 'usage'
      AND service_name IS NOT NULL`;

  const serviceBreakdownParams: any[] = [dateThreshold.toISOString()];

  if (userId) {
    serviceBreakdownQuery += " AND user_id = $2";
    serviceBreakdownParams.push(userId);
  }

  serviceBreakdownQuery += " GROUP BY service_name ORDER BY total_credits DESC";

  const serviceBreakdownResult = await sql.query(serviceBreakdownQuery, serviceBreakdownParams);
  return extractRows(serviceBreakdownResult) as ServiceBreakdown[];
}
