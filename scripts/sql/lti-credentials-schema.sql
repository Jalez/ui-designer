-- ============================================================================
-- LTI CREDENTIALS SCHEMA
-- ============================================================================
-- Per-user LTI consumer key/secret pairs for LTI 1.0 integration
-- ============================================================================

CREATE TABLE IF NOT EXISTS lti_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  consumer_key TEXT NOT NULL UNIQUE,
  consumer_secret TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lti_credentials_consumer_key ON lti_credentials(consumer_key);
CREATE INDEX IF NOT EXISTS idx_lti_credentials_user_id ON lti_credentials(user_id);

CREATE OR REPLACE FUNCTION update_lti_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lti_credentials_updated_at_trigger ON lti_credentials;
CREATE TRIGGER lti_credentials_updated_at_trigger
  BEFORE UPDATE ON lti_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_lti_credentials_updated_at();

COMMENT ON TABLE lti_credentials IS 'Per-user LTI consumer key/secret pairs for LTI 1.0 integration';
