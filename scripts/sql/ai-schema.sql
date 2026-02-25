-- ============================================================================
-- SCRIBA AI SCHEMA
-- ============================================================================
-- AI models and providers database schema
-- This schema handles:
--   - AI model configurations
--   - Provider information
--   - Model pricing and capabilities
--   - Provider status and availability
-- 
-- Note: Currently models and providers are stored in JSON files:
--   - /data/models.json (327 models)
--   - /data/providers.json (providers list)
-- 
-- This schema is for future migration when we want to move to database storage
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AI Providers
CREATE TABLE IF NOT EXISTS ai_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    privacy_policy_url TEXT,
    terms_of_service_url TEXT,
    status_page_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for providers
CREATE INDEX IF NOT EXISTS idx_ai_providers_slug ON ai_providers(slug);
CREATE INDEX IF NOT EXISTS idx_ai_providers_active ON ai_providers(is_active);

-- AI Models
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id VARCHAR(255) UNIQUE NOT NULL,  -- e.g., "openai/gpt-4"
    name VARCHAR(500) NOT NULL,
    provider_slug VARCHAR(255) REFERENCES ai_providers(slug),
    description TEXT,
    context_length INTEGER,
    
    -- Modalities (text->text, text+image->text, etc)
    modalities TEXT[] NOT NULL,
    
    -- Pricing information
    prompt_price DECIMAL(12, 8),      -- Price per token
    completion_price DECIMAL(12, 8),  -- Price per token
    image_price DECIMAL(10, 4),       -- Price per image
    request_price DECIMAL(10, 4),     -- Price per request
    
    -- Capabilities
    supports_tool_use BOOLEAN DEFAULT FALSE,
    supports_prompt_caching BOOLEAN DEFAULT FALSE,
    supports_response_schema BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    architecture JSONB,  -- Model architecture details
    top_provider JSONB,  -- Top provider info
    per_request_limits JSONB,  -- Rate limits
    
    -- API Provider selection (for any provider: provider name or "vercel-gateway")
    api_provider VARCHAR(50),  -- NULL for default behavior (use provider's direct API), "vercel-gateway" for Vercel AI Gateway, or specific provider name
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for models
CREATE INDEX IF NOT EXISTS idx_ai_models_model_id ON ai_models(model_id);
CREATE INDEX IF NOT EXISTS idx_ai_models_provider_slug ON ai_models(provider_slug);
CREATE INDEX IF NOT EXISTS idx_ai_models_modalities ON ai_models USING GIN(modalities);
CREATE INDEX IF NOT EXISTS idx_ai_models_active ON ai_models(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_models_prompt_price ON ai_models(prompt_price);
CREATE INDEX IF NOT EXISTS idx_ai_models_image_price ON ai_models(image_price);


-- Model Usage Analytics (tracks which models are actually being used)
CREATE TABLE IF NOT EXISTS model_usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    usage_type VARCHAR(50) NOT NULL,  -- 'text_completion', 'image_generation', etc
    tokens_used INTEGER,
    images_generated INTEGER,
    actual_cost DECIMAL(10, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for analytics
CREATE INDEX IF NOT EXISTS idx_model_usage_user_id ON model_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_model_id ON model_usage_analytics(model_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_created_at ON model_usage_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_usage_type ON model_usage_analytics(usage_type);

-- User Default Models (for storing user model preferences)
CREATE TABLE IF NOT EXISTS user_default_models (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    text_model VARCHAR(255),              -- nullable
    image_model VARCHAR(255),             -- nullable
    image_ocr_model VARCHAR(255),         -- nullable
    pdf_ocr_model VARCHAR(255),           -- nullable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user default models
CREATE INDEX IF NOT EXISTS idx_user_default_models_user_id ON user_default_models(user_id);

-- NOTE: To populate this schema from JSON files, create a migration script that:
-- 1. Reads /data/providers.json
-- 2. Inserts providers into ai_providers table
-- 3. Reads /data/models.json
-- 4. Inserts models into ai_models table with proper pricing structure
