# Database Schemas

This directory contains all SQL schemas for the Scriba application, organized by concern.

## Schema Files

### 1. `documents-schema.sql` - Document Management System
Core document functionality including:
- **Documents**: Main document storage with content (text, HTML, JSON)
- **Source Files**: Uploaded files (images, PDFs) linked to documents
- **Document Shares**: Sharing permissions and access control
- **Document Sessions**: Real-time collaboration sessions
- **Document Changes**: Operational transformation for collaborative editing

**Tables**: `documents`, `source_files`, `document_shares`, `document_sessions`, `document_changes`

### 2. `credits-schema.sql` - Credit System
User credits, billing, and service pricing:
- **Plan Configurations**: Available stripe subscription plans
- **User Subscriptions**: Stripe subscription data and status
- **User Plan Assignments**: Current plan state for each user
- **User Plan History**: Previous plan assignments for UX
- **User Credits**: Current credit balance and usage stats
- **Credit Transactions**: Complete audit log of all credit operations

**Tables**: ~~`plan_configurations`~~ (removed - plans now in Stripe), `user_subscriptions`, `user_plan_assignments`, `user_plan_history`, `user_credits`, `credit_transactions` 

### 3. `admin-schema.sql` - Admin Access Control
System administration and access management:
- **Admin Users**: Admin user management with roles and permissions

**Tables**: `admin_users`

### 4. `ai-schema.sql` - AI Models & Providers (Optional/Future)
AI model and provider database schema:
- **AI Providers**: Provider information and status
- **AI Models**: Model configurations, pricing, capabilities
- **User Model Preferences**: User's preferred models for different tasks
- **Model Usage Analytics**: Track model usage and costs

**Tables**: `ai_providers`, `ai_models`, `user_model_preferences`, `model_usage_analytics`

**Note**: Currently models and providers are stored in JSON files (`/data/models.json`, `/data/providers.json`). This schema is for future migration to database storage.

## Order of Application

The schemas must be applied in this order:
1. `documents-schema.sql` - Core document management (no dependencies)
2. `credits-schema.sql` - Credit and billing system (no dependencies)
3. `admin-schema.sql` - Admin access control (no dependencies)
4. `ai-schema.sql` - AI models and providers (optional, no dependencies)

## Usage

Use the helper scripts in the parent directory:

```bash
# Initialize database (applies both schemas)
./scripts/db-init.sh

# Purge all tables
./scripts/db-purge.sh

# Check database state
./scripts/db-check.sh
```

## Modifying Schemas

When making changes:
1. Edit the appropriate schema file
2. Run `./scripts/db-purge.sh` to drop all tables
3. Run `./scripts/db-init.sh` to recreate with new schema
4. Run `./scripts/db-check.sh` to verify

**Note**: In production, create migration scripts instead of purging!
