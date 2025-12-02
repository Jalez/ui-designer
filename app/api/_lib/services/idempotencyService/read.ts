import { extractRows, getSqlInstance } from "../../db/shared";
import { IDEMPOTENCY_TTL_DAYS, type IdempotencyRecord } from "./shared";

/**
 * Check if an event has already been processed
 */
export async function isEventProcessed(idempotencyKey: string): Promise<boolean> {
  try {
    const sql = await getSqlInstance();
    const result = await sql.query(
      `SELECT status FROM webhook_idempotency
       WHERE id = $1
       AND status = 'completed'
       AND created_at > NOW() - INTERVAL '${IDEMPOTENCY_TTL_DAYS} days'`,
      [idempotencyKey],
    );

    const rows = extractRows(result);
    return rows.length > 0;
  } catch (error) {
    console.error("SERVER: IDEMPOTENCY-ERROR: Failed to check event status:", error);
    // If we can't check, assume it's not processed to avoid blocking
    return false;
  }
}

/**
 * Get event processing status for monitoring
 */
export async function getEventStatus(idempotencyKey: string): Promise<IdempotencyRecord | null> {
  try {
    const sql = await getSqlInstance();
    const result = await sql.query(
      `SELECT * FROM webhook_idempotency
       WHERE id = $1
       AND created_at > NOW() - INTERVAL '${IDEMPOTENCY_TTL_DAYS} days'`,
      [idempotencyKey],
    );

    const rows = extractRows(result);
    return (rows[0] as IdempotencyRecord) || null;
  } catch (error) {
    console.error("SERVER: IDEMPOTENCY-ERROR: Failed to get event status:", error);
    return null;
  }
}

/**
 * Get processing statistics for monitoring
 */
export async function getProcessingStats(): Promise<{
  total_processed: number;
  currently_processing: number;
  failed_today: number;
  avg_retry_count: number;
}> {
  try {
    const sql = await getSqlInstance();
    const statsResult = await sql.query(
      `SELECT
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_processed,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as currently_processing,
        COUNT(CASE WHEN status = 'failed' AND DATE(created_at) = CURRENT_DATE THEN 1 END) as failed_today,
        ROUND(AVG(retry_count), 2) as avg_retry_count
      FROM webhook_idempotency
      WHERE created_at > NOW() - INTERVAL '30 days'`,
    );

    const statsRows = extractRows(statsResult);

    return {
      total_processed: parseInt(statsRows[0].total_processed as string) || 0,
      currently_processing: parseInt(statsRows[0].currently_processing as string) || 0,
      failed_today: parseInt(statsRows[0].failed_today as string) || 0,
      avg_retry_count: parseFloat(statsRows[0].avg_retry_count as string) || 0,
    };
  } catch (error) {
    console.error("SERVER: IDEMPOTENCY-ERROR: Failed to get processing stats:", error);
    return {
      total_processed: 0,
      currently_processing: 0,
      failed_today: 0,
      avg_retry_count: 0,
    };
  }
}
