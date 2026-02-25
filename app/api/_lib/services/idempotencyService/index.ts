// Re-export types from shared file

// Re-export all CRUD operations
export * from "./create";
export * from "./delete";
export * from "./read";
export type * from "./shared";
export * from "./update";

// Legacy IdempotencyService class for backward compatibility
import { markEventProcessing } from "./create";
import { cleanupOldRecords } from "./delete";
import { getEventStatus, getProcessingStats, isEventProcessed } from "./read";
import { markEventCompleted, markEventFailed } from "./update";

export class IdempotencyService {
  /**
   * Check if an event has already been processed
   */
  async isEventProcessed(idempotencyKey: string): Promise<boolean> {
    return await isEventProcessed(idempotencyKey);
  }

  /**
   * Mark an event as processing (initial state)
   */
  async markEventProcessing(idempotencyKey: string, eventId: string, eventType: string): Promise<void> {
    return await markEventProcessing(idempotencyKey, eventId, eventType);
  }

  /**
   * Mark an event as completed
   */
  async markEventCompleted(idempotencyKey: string): Promise<void> {
    return await markEventCompleted(idempotencyKey);
  }

  /**
   * Mark an event as failed with error details
   */
  async markEventFailed(idempotencyKey: string, error: string, retryCount: number): Promise<void> {
    return await markEventFailed(idempotencyKey, error, retryCount);
  }

  /**
   * Clean up old idempotency records
   */
  async cleanupOldRecords(): Promise<void> {
    return await cleanupOldRecords();
  }

  /**
   * Get event processing status for monitoring
   */
  async getEventStatus(idempotencyKey: string) {
    return await getEventStatus(idempotencyKey);
  }

  /**
   * Get processing statistics for monitoring
   */
  async getProcessingStats() {
    return await getProcessingStats();
  }
}

// Singleton instance
let idempotencyService: IdempotencyService;

export function getIdempotencyService(): IdempotencyService {
  if (!idempotencyService) {
    idempotencyService = new IdempotencyService();
  }
  return idempotencyService;
}
