# Schema Organization Summary

## Current Structure (4 Schemas)

### ✅ Properly Separated

```
sql/
├── documents-schema.sql   - Document management (6 tables)
├── credits-schema.sql     - Credit & billing (6 tables)
├── admin-schema.sql       - Admin access (1 table)
└── ai-schema.sql          - AI models & providers (4 tables, optional)
```

## Schema Details

### 📄 documents-schema.sql
**Concern**: Document storage, collaboration, file management
**Tables**: 6
- documents
- source_files
- document_shares
- document_sessions
- document_changes
- (Note: document_pages table was removed - page data now stored in documents.content_json)

**Dependencies**: None

---

### 💳 credits-schema.sql
**Concern**: Credit system, billing, service pricing
**Tables**: 6
- plan_configurations
- user_subscriptions (Stripe subscription data)
- user_plan_assignments (current plan state)
- user_plan_history (previous plan assignments)
- user_credits
- credit_transactions

**Dependencies**: None
**Note**: Fully normalized schema with separate subscription data, plan assignments, and history tracking

---

### 🔐 admin-schema.sql
**Concern**: System administration, access control
**Tables**: 1
- admin_users

**Dependencies**: None
**Why Separate**: Admin access is system-wide, not specific to credits or documents

---

### 🤖 ai-schema.sql
**Concern**: AI models, providers, preferences, analytics
**Tables**: 4
- ai_providers
- ai_models
- user_model_preferences
- model_usage_analytics

**Dependencies**: None
**Status**: OPTIONAL - Currently using JSON files
**Future**: For when we migrate from JSON to database

## Current Data Storage

| Data Type | Current Storage | Future Storage |
|-----------|----------------|----------------|
| Documents | ✅ Database (documents-schema) | Same |
| Credits | ✅ Database (credits-schema) | Same |
| Admin Users | ✅ Database (admin-schema) | Same |
| **AI Models** | 📄 JSON (`/data/models.json`) | 🔄 Database (ai-schema) |
| **AI Providers** | 📄 JSON (`/data/providers.json`) | 🔄 Database (ai-schema) |
| **User Model Prefs** | 📄 localStorage (zustand) | 🔄 Database + localStorage |

## Why This Structure?

### ✅ Clear Separation of Concerns
- **Documents** = Content management
- **Credits** = Billing and usage
- **Admin** = System access control
- **AI** = Models and providers (optional)

### ✅ Independent Schemas
Each schema can be:
- Applied separately
- Modified independently
- Scaled independently
- Migrated on different schedules

### ✅ No Cross-Dependencies
- No foreign keys between schemas
- Each is self-contained
- Easy to maintain and evolve

## Usage

### Initialize All Required Schemas
```bash
./scripts/db-init.sh
```
This applies:
1. documents-schema.sql ✓
2. credits-schema.sql ✓
3. admin-schema.sql ✓
4. ai-schema.sql (asks for confirmation)

### Purge Everything
```bash
./scripts/db-purge.sh
```
Drops tables from all schemas.

### Check Status
```bash
./scripts/db-check.sh
```
Shows all tables and data.

## Migration Path

### Current (JSON Files)
```
/data/models.json (327 models)
/data/providers.json (445 providers)
```

### Future (Database)
When ready to migrate:
1. Enable ai-schema during init
2. Create migration script to import JSON → Database
3. Update API routes to use database instead of JSON
4. Benefits:
   - ✅ Better query performance
   - ✅ Relationships and constraints
   - ✅ Easier analytics
   - ✅ Real-time updates
   - ✅ No file I/O overhead

## Notes

- **Admin users** are now properly separated (not tied to credits)
- **AI schema** is optional and ready when needed
- **No overlap** between any schemas
- **All migration features** preserved in base schemas
