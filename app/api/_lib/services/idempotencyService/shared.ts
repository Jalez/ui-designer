// Idempotency record interface
export interface IdempotencyRecord {
  id: string;
  event_id: string;
  event_type: string;
  created_at: Date;
  processed_at: Date;
  status: "processing" | "completed" | "failed";
  retry_count: number;
  last_error?: string;
}

// TTL for idempotency records (30 days)
export const IDEMPOTENCY_TTL_DAYS = 30;
