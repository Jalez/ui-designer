import { getSqlInstance } from "../../db/shared";

/**
 * Mark an event as processing (initial state)
 */
export async function markEventProcessing(idempotencyKey: string, eventId: string, eventType: string): Promise<void> {
  try {
    const sql = await getSqlInstance();
    await sql`
      INSERT INTO webhook_idempotency (id, event_id, event_type, status, retry_count)
      VALUES (${idempotencyKey}, ${eventId}, ${eventType}, 'processing', 0)
      ON CONFLICT (id) DO UPDATE SET
        updated_at = NOW(),
        retry_count = webhook_idempotency.retry_count + 1
      WHERE webhook_idempotency.status != 'completed'
    `;
  } catch (error) {
    console.error("SERVER: IDEMPOTENCY-ERROR: Failed to mark event as processing:", error);
    // Don't throw - allow processing to continue
  }
}
