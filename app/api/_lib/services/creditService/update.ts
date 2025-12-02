import type { DatabaseClient } from "../../db";
import { extractRows, getSqlInstance } from "../../db/shared";
import { calculateModelBasedCost } from "../modelService/utils/utils";
import { getUserEmail } from "../userService";
import { getSubscriptionData } from "../stripeService/subscriptionService";
import { getServiceCategory } from "./shared";
import type { CreditTransaction, ServiceUsageParams } from "./types";

type RefreshUserCreditsParams = {
  userId: string;
};

/**
 * Refresh user's credits for a new billing period
 */
export async function refreshUserCredits({ userId }: RefreshUserCreditsParams): Promise<void> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Get user email from userId
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      await client.query("ROLLBACK");
      throw new Error(`User email not found for userId: ${userId}`);
    }

    // Get user's current subscription from Stripe
    const subscriptionData = await getSubscriptionData(userEmail);
    const monthlyCredits = subscriptionData.monthlyCredits;

    if (Number.isNaN(monthlyCredits)) {
      await client.query("ROLLBACK");
      throw new Error("Invalid monthly credits from subscription");
    }

    // Get current credits
    const userCreditsResult = await client.query("SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE", [userId]);
    const userCreditsRows = extractRows(userCreditsResult);

    if (userCreditsRows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("User credits not found");
    }

    const currentCredits = userCreditsRows[0].current_credits as number;
    const totalEarned = userCreditsRows[0].total_credits_earned as number;

    // Set credits to the new plan amount (respecting max credits)
    const targetCredits = Math.min(monthlyCredits);
    const creditDelta = targetCredits - currentCredits;
    const isIncrease = creditDelta > 0;
    const newTotalEarned = isIncrease ? totalEarned + creditDelta : totalEarned;

    if (creditDelta === 0) {
      console.log(`SERVER: CREDITS-REFRESH: No credit adjustment needed for user ${userId}`);
      await client.query(
        `UPDATE user_credits
         SET updated_at = NOW()
         WHERE user_id = $1`,
        [userId],
      );
      await client.query("COMMIT");
      return;
    }

    await client.query(
      `UPDATE user_credits
       SET current_credits = $1, total_credits_earned = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [targetCredits, newTotalEarned, userId],
    );

    // Log transaction
    await client.query(
      `INSERT INTO credit_transactions
         (id, user_id, transaction_type, service_name, service_category, credits_used, credits_before, credits_after, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() AT TIME ZONE 'UTC')`,
      [
        crypto.randomUUID(),
        userId,
        isIncrease ? "bonus" : "reset",
        "monthly_refresh",
        "subscription",
        isIncrease ? -creditDelta : Math.abs(creditDelta),
        currentCredits,
        targetCredits,
        JSON.stringify({
          reason: isIncrease ? "monthly_credit_refresh" : "monthly_credit_reset",
          planName: subscriptionData.planName,
          monthlyCredits,
          previousCredits: currentCredits,
        }),
      ],
    );

    await client.query("COMMIT");
    console.log(
      `SERVER: CREDITS-REFRESH: ${isIncrease ? "Added" : "Removed"} ${Math.abs(creditDelta)} credits for user ${userId}; new balance ${targetCredits}`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("SERVER: CREDITS-REFRESH-ERROR: Error refreshing user credits:", error);
    throw error;
  } finally {
    // Note: We don't close the client here as it's managed by the pool
  }
}

/**
 * Deduct credits for service usage
 */
export async function deductCredits(
  params: ServiceUsageParams,
): Promise<{ success: boolean; remainingCredits?: number; creditsDeducted?: number }> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Calculate total cost
    const totalCost = calculateServiceCost(params);

    // Get current credits
    const userCreditsResult = await client.query("SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE", [
      params.userId,
    ]);
    const userCreditsRows = extractRows(userCreditsResult);

    if (userCreditsRows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false };
    }

    const currentCredits = userCreditsRows[0].current_credits as number;

    if (currentCredits < totalCost) {
      await client.query("ROLLBACK");
      return { success: false }; // Insufficient credits
    }

    // Deduct credits
    const newCredits = currentCredits - totalCost;
    const newTotalUsed = (userCreditsRows[0].total_credits_used as number) + totalCost;

    await client.query(
      `UPDATE user_credits
       SET current_credits = $1, total_credits_used = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [newCredits, newTotalUsed, params.userId],
    );

    // Log transaction
    const transactionMetadata = {
      ...params.metadata,
      modelId: params.modelInfo?.id,
      modelName: params.modelInfo?.name,
      provider: params.modelInfo?.id?.split("/")[0],
    };

    console.log("📊 MODEL_TRACKING - Saving transaction with metadata:", {
      modelId: transactionMetadata.modelId,
      modelName: transactionMetadata.modelName,
      provider: transactionMetadata.provider,
      serviceName: params.serviceName,
    });

    // Calculate actual monetary price from model pricing
    let actualPrice: number | undefined;
    if (params.modelInfo && !params.modelInfo.id.startsWith("ollama/")) {
      // For text generation
      if (params.promptTokens && params.completionTokens) {
        const promptCost = (params.promptTokens / 1000000) * parseFloat(params.modelInfo.pricing.prompt);
        const completionCost = (params.completionTokens / 1000000) * parseFloat(params.modelInfo.pricing.completion);
        actualPrice = promptCost + completionCost;
      }
      // For image generation
      else if (params.imageCount && params.modelInfo.pricing.image) {
        actualPrice = params.imageCount * parseFloat(params.modelInfo.pricing.image);
      }
    }

    const transactionData = {
      id: crypto.randomUUID(),
      userId: params.userId,
      transactionType: "usage" as const,
      serviceName: params.serviceName,
      creditsUsed: totalCost,
      creditsBefore: currentCredits,
      creditsAfter: newCredits,
      actualPrice,
      metadata: transactionMetadata,
    };

    console.log("🔍 CREDIT_TRACKING - Creating transaction record:", transactionData);
    await logTransaction(client, transactionData);
    console.log("🔍 CREDIT_TRACKING - Transaction logged successfully");

    await client.query("COMMIT");

    console.log("🔍 CREDIT_TRACKING - Credit transaction committed:", {
      userId: params.userId,
      serviceName: params.serviceName,
      creditsUsed: totalCost,
      newCredits,
    });

    return { success: true, remainingCredits: newCredits, creditsDeducted: totalCost };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

type ResetMonthlyCreditsParams = {
  userId?: string;
};
/**
 * Reset monthly credits for users (should be called monthly)
 */
export async function resetMonthlyCredits({ userId }: ResetMonthlyCreditsParams): Promise<void> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Get users to reset credits for
    const usersQuery = "SELECT user_id FROM user_credits";

    const usersResult = await client.query(usersQuery, userId ? [userId] : []);
    const users = extractRows(usersResult) as { user_id: string }[];

    // Process each user individually
    for (const user of users) {
      const userId = user.user_id;

      try {
        // Get user's subscription data from Stripe
        const subscriptionData = await getSubscriptionData(userId);
        const monthlyCredits = subscriptionData.monthlyCredits;

        if (Number.isNaN(monthlyCredits) || monthlyCredits <= 0) {
          console.warn(`Skipping credit reset for ${userId}: invalid monthly credits (${monthlyCredits})`);
          continue;
        }

        // Update user's credits
        const updateResult = await client.query(
          `UPDATE user_credits
           SET current_credits = LEAST(current_credits + $1, monthly_credits),
               last_reset_date = NOW(),
               updated_at = NOW()
           WHERE user_id = $2
           RETURNING current_credits`,
          [monthlyCredits, userId],
        );

        const updatedRows = extractRows(updateResult);
        if (updatedRows.length > 0) {
          const newCredits = updatedRows[0].current_credits as number;

          // Log reset transaction
          await logTransaction(client, {
            id: crypto.randomUUID(),
            userId: userId,
            transactionType: "reset",
            creditsUsed: -monthlyCredits,
            creditsBefore: newCredits - monthlyCredits,
            creditsAfter: newCredits,
            metadata: { reason: "monthly_reset", planName: subscriptionData.planName },
          });
        }
      } catch (error) {
        console.error(`Error resetting credits for user ${userId}:`, error);
        // Continue with other users instead of failing the entire batch
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

type AdminUpdateCreditsParams = {
  userId: string;
  credits: number;
  adminUserId: string;
  adminEmail: string;
};

/**
 * Admin update of user credits (sets absolute value)
 */
export async function adminUpdateCredits({
  userId,
  credits,
  adminUserId,
  adminEmail,
}: AdminUpdateCreditsParams): Promise<{ previousCredits: number; newCredits: number }> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Get previous credits for logging
    const existingUserResult = await client.query("SELECT current_credits FROM user_credits WHERE user_id = $1", [
      userId,
    ]);
    const existingUserRows = extractRows(existingUserResult);
    const previousCredits = existingUserRows.length > 0 ? (existingUserRows[0]?.current_credits as number) || 0 : 0;
    const transactionType = existingUserRows.length === 0 ? "admin_credit_initial" : "admin_credit_update";

    // Upsert user credits (insert or update if exists)
    await client.query(
      `INSERT INTO user_credits (id, user_id, current_credits, total_credits_earned, total_credits_used, last_reset_date, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 0, NOW(), NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         current_credits = EXCLUDED.current_credits,
         total_credits_earned = EXCLUDED.total_credits_earned,
         updated_at = NOW()`,
      [userId, credits, credits],
    );

    console.log(
      `${existingUserRows.length === 0 ? "Created" : "Updated"} credits for ${userId} ${existingUserRows.length === 0 ? "to" : `from ${previousCredits} to`} ${credits} by admin ${adminEmail}`,
    );

    // Log the credit transaction for audit purposes
    try {
      await client.query(
        `INSERT INTO credit_transactions (id, user_id, transaction_type, credits_used, credits_before, credits_after, metadata, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
        [
          userId,
          transactionType,
          Math.abs(credits - previousCredits),
          previousCredits,
          credits,
          JSON.stringify({
            modified_by: adminUserId,
            admin_action: true,
            previous_credits: previousCredits,
            new_credits: credits,
          }),
        ],
      );
    } catch (logError) {
      console.error("Failed to log credit transaction:", logError);
      // Don't fail the request if logging fails
    }

    await client.query("COMMIT");

    return { previousCredits, newCredits: credits };
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error updating credits:", error);
    throw error;
  }
}

// Helper functions
function calculateServiceCost(params: ServiceUsageParams): number {
  // If model info is provided, use model-based pricing
  if (params.modelInfo) {
    return calculateModelBasedCost(params);
  }

  // Fallback to legacy service-based calculation for backward compatibility
  // This can be removed once all callers are updated to provide model info
  console.warn("SERVER: DEPRECATED-CALC: Using legacy service cost calculation for", params.serviceName);
  throw new Error("Service costs functionality has been deprecated and replaced by model-based pricing");
}

async function logTransaction(
  client: DatabaseClient,
  transaction: Omit<CreditTransaction, "createdAt">,
): Promise<void> {
  // Fetch service category if not provided
  let serviceCategory = transaction.serviceCategory;
  if (transaction.serviceName && serviceCategory === undefined) {
    serviceCategory = getServiceCategory(transaction.serviceName);
  }

  await client.query(
    `INSERT INTO credit_transactions
       (id, user_id, transaction_type, service_name, service_category, credits_used, credits_before, credits_after, actual_price, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() AT TIME ZONE 'UTC')`,
    [
      transaction.id,
      transaction.userId,
      transaction.transactionType,
      transaction.serviceName || null,
      serviceCategory,
      transaction.creditsUsed,
      transaction.creditsBefore,
      transaction.creditsAfter,
      transaction.actualPrice || null,
      transaction.metadata ? JSON.stringify(transaction.metadata) : null,
    ],
  );
}
