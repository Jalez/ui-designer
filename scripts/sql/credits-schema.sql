-- ============================================================================
-- SCRIBA CREDITS SCHEMA - STRIPE-ONLY ARCHITECTURE
-- ============================================================================
-- Credit system with Stripe as the ONLY source of truth
-- This schema handles:
--   - User credit balances and tracking (our business logic)
--   - Credit transaction history and audit trail
--   - User subscription cache (optional - could be eliminated)
--
-- Everything else (plans, subscriptions, history) comes from Stripe APIs
-- Plans are defined in Stripe dashboard
-- User subscriptions queried from Stripe
-- Plan history derived from Stripe subscription history
-- Note: This is independent of the documents schema and can be applied separately
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Plan Configurations REMOVED - Plans are now defined in Stripe only
-- All plan definitions, pricing, and features come from Stripe dashboard
-- TODO: Drop plan_configurations table when confirmed working

-- User Subscriptions REMOVED - Now queried directly from Stripe
-- All subscription data comes from Stripe APIs
-- Table can be dropped: DROP TABLE IF EXISTS user_subscriptions;

-- User Plan Assignments REMOVED - Current plan derived from active Stripe subscription
-- Table can be dropped: DROP TABLE IF EXISTS user_plan_assignments;

-- User Plan History REMOVED - Plan history derived from Stripe subscription history
-- Table can be dropped: DROP TABLE IF EXISTS user_plan_history;

-- User Credits
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_credits INTEGER NOT NULL DEFAULT 0 CHECK (current_credits >= 0),
    total_credits_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_credits_earned >= 0),
    total_credits_used INTEGER NOT NULL DEFAULT 0 CHECK (total_credits_used >= 0),
    last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Credit Transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('usage', 'subscription', 'reset', 'bonus', 'refund')),
    service_name VARCHAR(100),  -- Shorter limit
    service_category VARCHAR(50),  -- Shorter limit
    credits_used INTEGER NOT NULL,
    credits_before INTEGER NOT NULL CHECK (credits_before >= 0),
    credits_after INTEGER NOT NULL CHECK (credits_after >= 0),
    actual_price DECIMAL(10, 4) CHECK (actual_price >= 0),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance

-- All user subscription/plan indexes removed - data comes from Stripe

-- User credits
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- Credit transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_service_name ON credit_transactions(service_name);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_service_category ON credit_transactions(service_category);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_actual_price ON credit_transactions(actual_price);