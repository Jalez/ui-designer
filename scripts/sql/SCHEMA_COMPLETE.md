# Complete Database Schema Overview

## Quick Reference

### Documents Schema (5 tables)
```
documents              - Main document storage with content
source_files          - Uploaded files (images, PDFs)
document_shares       - Sharing permissions and access control
document_sessions     - Real-time collaboration sessions
document_changes      - Operational transformation for editing
```

### Credits Schema (6 tables)
```
plan_configurations     - Available subscription plans
user_subscriptions     - Stripe subscription data
user_plan_assignments  - Current plan state for users
user_plan_history      - Previous plan assignments
user_credits           - Credit balance and usage tracking
credit_transactions    - Complete transaction history
```

### Admin Schema (1 table)
```
admin_users            - Admin access control
```

## Table Details

### 📄 documents
```sql
id                  VARCHAR(36) PRIMARY KEY   -- UUID format
user_id             VARCHAR(255) NOT NULL
title               VARCHAR(500) NOT NULL
content             TEXT
content_html        TEXT
content_json        TEXT                      -- Editor JSON content
has_been_entered    BOOLEAN DEFAULT FALSE
is_temporary        BOOLEAN DEFAULT FALSE     -- Temporary documents for unauthenticated users
anonymous_session_id VARCHAR(255)             -- Session ID for temporary documents
claimed_at          TIMESTAMP WITH TIME ZONE  -- When document was claimed by user
expires_at          TIMESTAMP WITH TIME ZONE  -- Expiration for temporary documents
created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 📄 source_files
```sql
id                  VARCHAR(36) PRIMARY KEY   -- UUID format
document_id         VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE
file_type           VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'pdf', 'document'))
file_name           VARCHAR(500) NOT NULL
file_size           INTEGER CHECK (file_size > 0)
mime_type           VARCHAR(100)
file_path           TEXT                      -- Local file path or data URL
drive_file_id       VARCHAR(100)             -- Google Drive files (shorter ID)
sections            TEXT[]                   -- Array of position ranges like ["0-3", "14-21"]
highlight_color     VARCHAR(7)               -- Hex color codes (#RRGGBB)
web_view_link       TEXT
web_content_link    TEXT
created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 📄 document_shares
```sql
id                  VARCHAR(36) PRIMARY KEY   -- UUID format
document_id         VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE
owner_user_id       VARCHAR(255) NOT NULL    -- Document owner
shared_user_id   VARCHAR(255)             -- Email of user being shared with (NULL for guest access)
permission          VARCHAR(10) NOT NULL DEFAULT 'viewer' CHECK (permission IN ('owner', 'editor', 'viewer'))
allow_guest_access  BOOLEAN DEFAULT FALSE    -- Whether to allow unauthenticated access
created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
UNIQUE(document_id, shared_user_id)
```

### 📄 document_sessions
```sql
id                  VARCHAR(36) PRIMARY KEY   -- UUID format
document_id         VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE
user_id             VARCHAR(255) NOT NULL
user_email          VARCHAR(255) NOT NULL
user_name           VARCHAR(255)
last_active_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
cursor_position     JSONB                     -- Store cursor position and selection
created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 📄 document_changes
```sql
id                  VARCHAR(36) PRIMARY KEY   -- UUID format
document_id         VARCHAR(36) REFERENCES documents(id) ON DELETE CASCADE
session_id          VARCHAR(36) REFERENCES document_sessions(id) ON DELETE CASCADE
user_id             VARCHAR(255) NOT NULL
version             BIGINT NOT NULL          -- Version number for ordering
operation           JSONB NOT NULL           -- The operation data
created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 💳 plan_configurations
```sql
id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4()
plan_name           VARCHAR(100) NOT NULL UNIQUE
description         TEXT
monthly_credits     INTEGER NOT NULL CHECK (monthly_credits >= 0)
stripe_product_id   VARCHAR(100) UNIQUE     -- Stripe product ID
stripe_monthly_price_id VARCHAR(100) UNIQUE -- Stripe price ID for monthly
stripe_yearly_price_id VARCHAR(100) UNIQUE  -- Stripe price ID for yearly
price               DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (price >= 0)
currency            VARCHAR(3) DEFAULT 'USD'
features            JSONB DEFAULT '[]'::jsonb
is_active           BOOLEAN DEFAULT TRUE
created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 💳 user_subscriptions
```sql
id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_email              VARCHAR(255) NOT NULL
stripe_subscription_id  VARCHAR(100) UNIQUE NOT NULL  -- Stripe IDs are shorter
stripe_customer_id      VARCHAR(100) NOT NULL         -- Stripe IDs are shorter
subscription_status     VARCHAR(20) NOT NULL CHECK (subscription_status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid'))
current_period_start    TIMESTAMP WITH TIME ZONE NOT NULL
current_period_end      TIMESTAMP WITH TIME ZONE NOT NULL
stripe_price_id         VARCHAR(100) NOT NULL         -- Stripe IDs are shorter
cancel_at_period_end    BOOLEAN DEFAULT FALSE
created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
UNIQUE(user_email, stripe_subscription_id)
```

### 💳 user_plan_assignments
```sql
id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_email              VARCHAR(255) UNIQUE NOT NULL
plan_name               VARCHAR(100) NOT NULL DEFAULT 'Free Plan'
monthly_credits         INTEGER NOT NULL DEFAULT 50 CHECK (monthly_credits >= 0)
effective_date          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
FOREIGN KEY (plan_name) REFERENCES plan_configurations(plan_name)
```

### 💳 user_plan_history
```sql
id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_email              VARCHAR(255) NOT NULL
plan_name               VARCHAR(100) NOT NULL
monthly_credits         INTEGER NOT NULL CHECK (monthly_credits >= 0)
stripe_price_id         VARCHAR(100)                 -- Stripe IDs are shorter
assigned_at             TIMESTAMP WITH TIME ZONE NOT NULL
unassigned_at           TIMESTAMP WITH TIME ZONE CHECK (unassigned_at > assigned_at)
created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 💳 user_credits
```sql
id                      UUID PRIMARY KEY
user_email              VARCHAR(255) UNIQUE NOT NULL
current_credits         INTEGER DEFAULT 0
total_credits_earned    INTEGER DEFAULT 0
total_credits_used      INTEGER DEFAULT 0
last_reset_date         TIMESTAMP WITH TIME ZONE
created_at              TIMESTAMP WITH TIME ZONE
updated_at              TIMESTAMP WITH TIME ZONE
```

### 💳 credit_transactions
```sql
id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4()
user_email              VARCHAR(255) NOT NULL
transaction_type        VARCHAR(20) NOT NULL CHECK (transaction_type IN ('usage', 'subscription', 'reset', 'bonus', 'refund'))
service_name            VARCHAR(100)                -- Shorter limit
service_category        VARCHAR(50)                 -- Shorter limit
credits_used            INTEGER NOT NULL
credits_before          INTEGER NOT NULL CHECK (credits_before >= 0)
credits_after           INTEGER NOT NULL CHECK (credits_after >= 0)
actual_price            DECIMAL(10, 4) CHECK (actual_price >= 0)
metadata                JSONB
created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

### 🔐 admin_users
```sql
id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4()
email                   VARCHAR(255) UNIQUE NOT NULL
role                    VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin', 'moderator'))
granted_by              VARCHAR(255)
granted_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
is_active               BOOLEAN DEFAULT TRUE
created_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
updated_at              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
```

## Indexes

### Documents Schema
- `idx_documents_user_id` - documents(user_id)
- `idx_documents_updated_at` - documents(updated_at)
- `idx_source_files_document_id` - source_files(document_id)
- `idx_document_shares_document_id` - document_shares(document_id)
- `idx_document_shares_shared_user_email` - document_shares(shared_user_id)
- `idx_document_sessions_document_id` - document_sessions(document_id)
- `idx_document_sessions_last_active` - document_sessions(last_active_at)
- `idx_document_changes_document_id` - document_changes(document_id)
- `idx_document_changes_version` - document_changes(document_id, version)
- `idx_documents_temporary_expires` - documents(is_temporary, expires_at) WHERE is_temporary = TRUE
- `idx_documents_anonymous_session` - documents(anonymous_session_id) WHERE is_temporary = TRUE

### Credits Schema
- `idx_plan_configurations_active` - plan_configurations(is_active) WHERE is_active = TRUE
- `idx_plan_configurations_price` - plan_configurations(price)
- `idx_user_subscriptions_user_email` - user_subscriptions(user_email)
- `idx_user_subscriptions_stripe_subscription_id` - user_subscriptions(stripe_subscription_id)
- `idx_user_subscriptions_stripe_customer_id` - user_subscriptions(stripe_customer_id)
- `idx_user_subscriptions_status` - user_subscriptions(subscription_status)
- `idx_user_subscriptions_current_period_end` - user_subscriptions(current_period_end)
- `idx_user_plan_assignments_user_email` - user_plan_assignments(user_email)
- `idx_user_plan_assignments_plan_name` - user_plan_assignments(plan_name)
- `idx_user_plan_history_user_email` - user_plan_history(user_email)
- `idx_user_plan_history_assigned_at` - user_plan_history(assigned_at DESC)
- `idx_user_plan_history_unassigned_at` - user_plan_history(unassigned_at) WHERE unassigned_at IS NOT NULL
- `idx_user_credits_email` - user_credits(user_email)
- `idx_credit_transactions_user_email` - credit_transactions(user_email)
- `idx_credit_transactions_created_at` - credit_transactions(created_at DESC)
- `idx_credit_transactions_service_name` - credit_transactions(service_name)
- `idx_credit_transactions_service_category` - credit_transactions(service_category)
- `idx_credit_transactions_actual_price` - credit_transactions(actual_price)

### Admin Schema
- `idx_admin_users_email` - admin_users(email)
- `idx_admin_users_active` - admin_users(is_active)

## Triggers

### Documents Schema
- `update_documents_updated_at` - Auto-update documents.updated_at
- `update_document_shares_updated_at` - Auto-update document_shares.updated_at
- `update_document_sessions_updated_at` - Auto-update document_sessions.updated_at

### Credits Schema
None (timestamps managed by application)

## Key Differences

| Aspect | Documents Schema | Credits Schema | Admin Schema |
|--------|------------------|----------------|--------------|
| Primary Keys | VARCHAR(36) UUIDs | UUID | UUID |
| Triggers | Yes (updated_at) | No | No |
| Foreign Keys | Yes (CASCADE) | Yes (plan assignments) | No |
| Default Values | Some | Many | Many |
| Check Constraints | permissions, file types | transaction types, credits >= 0 | roles, email format |

## ✨ Schema Evolution

The schemas have evolved significantly:
- ✅ **Documents**: Added temporary document support (anonymous sessions, expiration)
- ✅ **Credits**: Complete normalization with separate subscription/plan data
- ✅ **Admin**: Moved to dedicated schema with enhanced role management
- ✅ **Primary Keys**: Standardized to VARCHAR(36) UUIDs for documents, UUID for credits/admin
- ✅ **Indexes**: Comprehensive indexing for performance
- ✅ **Constraints**: Robust data validation and referential integrity

## Usage

```bash
# Initialize fresh database
./scripts/db-purge.sh
./scripts/db-init.sh

# Verify
./scripts/db-check.sh
```
