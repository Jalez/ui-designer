import { getSqlInstance } from "../../db/shared";

/**
 * Mark an event as completed
 */
export async function markEventCompleted(idempotencyKey: string): Promise<void> {
  try {
    const sql = await getSqlInstance();
    await sql`
      UPDATE webhook_idempotency
      SET status = 'completed', processed_at = NOW(), updated_at = NOW()
      WHERE id = ${idempotencyKey}
    `;
  } catch (error) {
    console.error("SERVER: IDEMPOTENCY-ERROR: Failed to mark event as completed:", error);
    // Don't throw - the event was processed successfully even if we couldn't update the record
  }
}

/**
 * Mark an event as failed with error details
 */
export async function markEventFailed(idempotencyKey: string, error: string, retryCount: number): Promise<void> {
  try {
    const sql = await getSqlInstance();
    await sql`
      UPDATE webhook_idempotency
      SET status = 'failed',
          last_error = ${error},
          retry_count = ${retryCount},
          updated_at = NOW()
      WHERE id = ${idempotencyKey}
    `;
  } catch (dbError) {
    console.error("SERVER: IDEMPOTENCY-ERROR: Failed to mark event as failed:", dbError);
    // Don't throw - the processing failure is already handled
  }
}
