import { getSqlInstance, extractRows } from "../../db/shared";
import { IDEMPOTENCY_TTL_DAYS } from "./shared";

/**
 * Clean up old idempotency records
 */
export async function cleanupOldRecords(): Promise<void> {
  try {
    const sql = await getSqlInstance();
    const result = await sql`
      DELETE FROM webhook_idempotency
      WHERE created_at < NOW() - INTERVAL '${IDEMPOTENCY_TTL_DAYS} days'
    `;

    // For Neon, we can't reliably get rowCount, so we just log that cleanup ran
    // For PostgreSQL, rowCount would be available but we handle it generically
    console.log(`SERVER: IDEMPOTENCY-CLEANUP: Cleaned up old records (cleanup completed)`);
  } catch (error) {
    console.error("SERVER: IDEMPOTENCY-ERROR: Failed to cleanup old records:", error);
  }
}
