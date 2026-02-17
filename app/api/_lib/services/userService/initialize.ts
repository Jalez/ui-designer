import { extractRows, getSqlInstance } from "../../db/shared";
import { getFreePlanFromStripe } from "../stripeService";

/**
 * Initialize user credits (creates entry in user_credits table)
 */
export async function initializeUserCredits(userId: string, initialCredits: number): Promise<void> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Check if user credits already exist
    const existingCredits = await client.query("SELECT 1 FROM user_credits WHERE user_id = $1", [userId]);
    const existingCreditsRows = extractRows(existingCredits);

    if (existingCreditsRows.length === 0) {
      const creditsId = crypto.randomUUID();

      // Create user credits
      await client.query(
        `INSERT INTO user_credits (id, user_id, current_credits, total_credits_earned, total_credits_used)
         VALUES ($1, $2, $3, $4, $5)`,
        [creditsId, userId, initialCredits, initialCredits, 0],
      );

      // Log initial credit allocation transaction
      await logInitialCreditTransaction(client, userId, initialCredits);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/**
 * Initialize user plan assignment - no longer needed since plans come from Stripe
 * This function is kept for backward compatibility but doesn't do anything
 */
export async function initializeUserPlan(userId: string, _planName: string, _monthlyCredits: number): Promise<void> {
  console.log(`User ${userId} plan initialization skipped - using Stripe data`);
}

/**
 * Initialize user with default free plan and credits
 */
export async function initializeUser(userId: string): Promise<void> {
  const sql = await getSqlInstance();
  const client = await sql;

  try {
    await client.query("BEGIN");

    // Check if user already has credits (indicating they're initialized)
    const existingCredits = await client.query("SELECT 1 FROM user_credits WHERE user_id = $1", [userId]);
    const existingCreditsRows = extractRows(existingCredits);

    if (existingCreditsRows.length === 0) {
      // Get free plan from Stripe using shared function
      const freePlanData = await getFreePlanFromStripe();
      const freePlan = {
        plan_name: freePlanData.planName,
        monthly_credits: freePlanData.monthlyCredits,
      };

      // Initialize credits only (plans come from Stripe)
      await initializeUserCredits(userId, freePlan.monthly_credits);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

/**
 * Ensure user is initialized (idempotent - safe to call multiple times)
 */
export async function ensureUserInitialized(userId: string): Promise<void> {
  await initializeUser(userId);
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
  await ensureUserInitialized(userId);
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
