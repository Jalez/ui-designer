import { extractRows, getSqlInstance } from "../../db/shared";
import type { TransactionMetadata } from "./types";

type SetCreditsParams = {
  userId: string;
  credits: number;
  metadata?: TransactionMetadata;
};
/**
 * Set credits to a specific amount (for plan changes, admin adjustments, etc.)
 */
export async function setCredits({ userId, credits, metadata }: SetCreditsParams): Promise<void> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Get current credits
    const userCreditsResult = await client.query("SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE", [userId]);
    const userCreditsRows = extractRows(userCreditsResult);

    if (userCreditsRows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("User credits not found");
    }

    const currentCredits = userCreditsRows[0].current_credits as number;
    const currentTotalEarned = userCreditsRows[0].total_credits_earned as number;
    const creditsDifference = credits - currentCredits;
    const newTotalEarned = currentTotalEarned + creditsDifference;

    await client.query(
      `UPDATE user_credits
       SET current_credits = $1, total_credits_earned = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [credits, newTotalEarned, userId],
    );

    // Log transaction
    await logTransaction(client, {
      id: crypto.randomUUID(),
      userId,
      transactionType: "bonus",
      creditsUsed: -creditsDifference, // Negative for additions, positive for deductions
      creditsBefore: currentCredits,
      creditsAfter: credits,
      metadata,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

type AddCreditsParams = {
  userId: string;
  credits: number;
  transactionType: "subscription" | "bonus" | "refund";
  metadata?: TransactionMetadata;
};

/**
 * Add credits to user account (for subscriptions, bonuses, etc.)
 */
export async function addCredits({ userId, credits, transactionType, metadata }: AddCreditsParams): Promise<void> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Get current credits
    const userCreditsResult = await client.query("SELECT * FROM user_credits WHERE user_id = $1 FOR UPDATE", [userId]);
    const userCreditsRows = extractRows(userCreditsResult);

    if (userCreditsRows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("User credits not found");
    }

    const currentCredits = userCreditsRows[0].current_credits as number;
    const currentTotalEarned = userCreditsRows[0].total_credits_earned as number;
    const newCredits = currentCredits + credits;
    const newTotalEarned = currentTotalEarned + credits;

    await client.query(
      `UPDATE user_credits
       SET current_credits = $1, total_credits_earned = $2, updated_at = NOW()
       WHERE user_id = $3`,
      [newCredits, newTotalEarned, userId],
    );

    // Log transaction
    await logTransaction(client, {
      id: crypto.randomUUID(),
      userId,
      transactionType,
      creditsUsed: -credits, // Negative for additions
      creditsBefore: currentCredits,
      creditsAfter: newCredits,
      metadata,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

// Helper function to log transactions
async function logTransaction(
  client: any,
  transaction: Omit<import("./shared").CreditTransaction, "createdAt">,
): Promise<void> {
  await client.query(
    `INSERT INTO credit_transactions
       (id, user_id, transaction_type, service_name, service_category, credits_used, credits_before, credits_after, actual_price, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW() AT TIME ZONE 'UTC')`,
    [
      transaction.id,
      transaction.userId,
      transaction.transactionType,
      transaction.serviceName || null,
      transaction.serviceCategory,
      transaction.creditsUsed,
      transaction.creditsBefore,
      transaction.creditsAfter,
      transaction.actualPrice || null,
      transaction.metadata ? JSON.stringify(transaction.metadata) : null,
    ],
  );
}
