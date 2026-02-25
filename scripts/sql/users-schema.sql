-- Users Schema: Internal user identification with Stripe integration
-- Central user table with UUID primary keys and Stripe customer linkage

-- Central users table with UUID primary keys
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  image TEXT,
  email_verified TIMESTAMP WITH TIME ZONE,
  stripe_customer_id VARCHAR(100) UNIQUE,  -- Stripe customer ID for subscription queries
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Helper functions for user management
CREATE OR REPLACE FUNCTION get_or_create_user_id(user_email TEXT)
RETURNS UUID AS $$
DECLARE
  user_id UUID;
BEGIN
  -- Try to find existing user
  SELECT id INTO user_id FROM users WHERE email = user_email;

  -- If not found, create new user
  IF user_id IS NULL THEN
    INSERT INTO users (email) VALUES (user_email)
    RETURNING id INTO user_id;
  END IF;

  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_email(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_email TEXT;
BEGIN
  SELECT email INTO user_email FROM users WHERE id = user_id;
  RETURN user_email;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE users IS 'Central user table with UUID primary keys and Stripe integration. Safe to expose user IDs in URLs.';
COMMENT ON COLUMN users.id IS 'Internal UUID for user identification - safe to expose in URLs';
COMMENT ON COLUMN users.email IS 'User email address - sensitive, avoid exposing in URLs/logs';
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for querying subscription and payment data';
COMMENT ON FUNCTION get_or_create_user_id(TEXT) IS 'Gets existing user ID or creates new user if email not found';
COMMENT ON FUNCTION get_user_email(UUID) IS 'Gets user email by internal user ID';
