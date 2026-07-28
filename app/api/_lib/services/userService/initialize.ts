import { withTransaction } from "../../db";
import { extractRows, getSqlInstance } from "../../db/shared";

/**
 * Initialize user credits (creates entry in user_credits table)
 */
export async function initializeUserCredits(userId: string, initialCredits: number): Promise<void> {
  await withTransaction(async (client) => {
    const creditsId = crypto.randomUUID();
    const insertedCredits = await client.query(
      `INSERT INTO user_credits (id, user_id, current_credits, total_credits_earned, total_credits_used)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id`,
      [creditsId, userId, initialCredits, initialCredits, 0],
    );
    const insertedCreditsRows = extractRows(insertedCredits);

    if (insertedCreditsRows.length > 0) {
      // Only the caller that won the insert race should log the initial allocation.
      await logInitialCreditTransaction(client, userId, initialCredits);
    }
  });
}

/**
 * Initialize user plan assignment - no longer needed since plans come from Stripe
 * This function is kept for backward compatibility but doesn't do anything
 */
export async function initializeUserPlan(userId: string, _planName: string, _monthlyCredits: number): Promise<void> {
  console.log(`User ${userId} plan initialization skipped - using Stripe data`);
}



/**
 * Ensure user is initialized by email (converts email to userId first)
 */
export async function ensureUserInitializedByEmail(userEmail: string): Promise<string> {
  const sql = await getSqlInstance();

  // Get user ID from email
  const userResult = await sql.query("SELECT id FROM users WHERE email = $1", [userEmail]);
  const userRows = extractRows(userResult);

  if (userRows.length === 0) {
    throw new Error(`User not found with email: ${userEmail}`);
  }

  const userId = userRows[0].id;
  return userId;
}

/**
 * Log initial credit allocation transaction
 */
async function logInitialCreditTransaction(client: unknown, userId: string, initialCredits: number): Promise<void> {
  const dbClient = client as { query: (sql: string, params: unknown[]) => Promise<unknown> };
  await dbClient.query(
    `INSERT INTO credit_transactions
     (id, user_id, transaction_type, credits_used, credits_before, credits_after, metadata, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'UTC')`,
    [
      crypto.randomUUID(),
      userId,
      "bonus",
      -initialCredits, // Negative for additions
      0, // credits_before
      initialCredits, // credits_after
      JSON.stringify({ reason: "initial_allocation" }),
    ],
  );
}
