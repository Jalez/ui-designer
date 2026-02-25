-- Webhook Idempotency Table
-- Ensures webhook events are processed only once and tracks processing status

CREATE TABLE IF NOT EXISTS webhook_idempotency (
  id VARCHAR(100) PRIMARY KEY,  -- Stripe event IDs are shorter
  event_id VARCHAR(100) NOT NULL UNIQUE,  -- Stripe event IDs are shorter
  event_type VARCHAR(50) NOT NULL,  -- Shorter limit
  status VARCHAR(15) NOT NULL CHECK (status IN ('processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  CHECK (processed_at IS NULL OR processed_at >= created_at),  -- Processed time should be after creation
  CHECK (status != 'completed' OR processed_at IS NOT NULL)  -- Completed events must have processed_at
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_status ON webhook_idempotency(status);
CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_event_id ON webhook_idempotency(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_created_at ON webhook_idempotency(created_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_webhook_idempotency_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_webhook_idempotency_updated_at ON webhook_idempotency;
CREATE TRIGGER update_webhook_idempotency_updated_at
  BEFORE UPDATE ON webhook_idempotency
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_idempotency_updated_at();

-- Comments
COMMENT ON TABLE webhook_idempotency IS 'Tracks webhook event processing to prevent duplicates and enable retries';
COMMENT ON COLUMN webhook_idempotency.id IS 'Idempotency key (composite of event type, ID, and timestamp)';
COMMENT ON COLUMN webhook_idempotency.event_id IS 'Stripe webhook event ID';
COMMENT ON COLUMN webhook_idempotency.event_type IS 'Stripe webhook event type (e.g., customer.subscription.created)';
COMMENT ON COLUMN webhook_idempotency.status IS 'Processing status: processing, completed, or failed';
COMMENT ON COLUMN webhook_idempotency.retry_count IS 'Number of retry attempts made';
COMMENT ON COLUMN webhook_idempotency.last_error IS 'Last error message if processing failed';
COMMENT ON COLUMN webhook_idempotency.processed_at IS 'Timestamp when event was successfully processed';

