# PostgreSQL Migration Complete ✅

## What Was Changed

### ✅ Database Connection (Phase 1)
- **Updated** [`lib/db/index.ts`](lib/db/index.ts) - Now uses PostgreSQL instead of SQLite
  - Changed dialect from `sqlite` to `postgres`
  - Uses `DATABASE_URL` from environment
  - Added connection pooling
  - Removed sqlite3 dependencies

### ✅ Scripts Updated (Phase 2 & 4)
- **Updated** [`scripts/db-init.ts`](scripts/db-init.ts)
  - Removed documents-schema reference
  - Added projects-schema for Maps, Levels, Projects
  - Admin user (raitsu11@gmail.com) is added automatically via admin-schema.sql
  - Updated step labels to reflect ui-designer's needs

- **Replaced** [`scripts/db-check.ts`](scripts/db-check.ts)
  - New UI-Designer specific version
  - Checks for: users, admin_roles, Maps, Levels, Projects, user_credits
  - Removed document-specific checks
  - Shows expected vs actual tables

- **Updated** [`scripts/db-purge.ts`](scripts/db-purge.ts)
  - Removed document tables
  - Added project tables (Maps, Levels, MapLevels, Projects)
  - Proper CASCADE drop order

- **Deleted** `scripts/cleanup-temporary-documents.ts`
  - No longer needed (ui-designer doesn't have documents)

### ✅ Documentation (Phase 3)
- **Created** [`DATABASE_SETUP.md`](DATABASE_SETUP.md)
  - Complete setup instructions
  - Shared PostgreSQL architecture explained
  - Troubleshooting guide
  - Migration from SQLite instructions

### ✅ Schema Verified (Phase 2)
- **Verified** [`scripts/sql/admin-schema.sql`](scripts/sql/admin-schema.sql)
  - Already includes raitsu11@gmail.com as default admin
  - Uses `admin_roles` table (not admin_users)
  - Links to users table correctly

## What You Need To Do

### 1. Create .env.local File
**⚠️ REQUIRED - Do this first!**

Create `.env.local` in the ui-designer root:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ui_designer_dev
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
# Add other environment variables as needed
```

### 2. Start PostgreSQL
From scriba directory:
```bash
cd ../scriba-project/scriba/apps/web
docker-compose up -d postgres
```

### 3. Create Database
```bash
docker exec -it scriba-postgres psql -U postgres -c "CREATE DATABASE ui_designer_dev;"
```

### 4. Initialize Schema
```bash
cd ui-designer
pnpm tsx scripts/db-init.ts -y
```

### 5. Verify Setup
```bash
pnpm db:check
```

### 6. Remove SQLite (Optional)
```bash
pnpm remove sqlite3
```

### 7. Restart Development Server
```bash
pnpm run dev
```

## Architecture: Shared PostgreSQL Instance

```
┌─────────────────────────────────────┐
│  PostgreSQL Docker Container        │
│  (from scriba-project)              │
│                                      │
│  ├─ scriba_dev (database)          │
│  │   └─ Scriba tables              │
│  │                                  │
│  └─ ui_designer_dev (database)     │
│      ├─ users                       │
│      ├─ admin_roles                 │
│      ├─ user_credits                │
│      ├─ Maps                        │
│      ├─ Levels                      │
│      ├─ MapLevels                   │
│      └─ Projects                    │
└─────────────────────────────────────┘
```

## Benefits

✅ **Consistency**: Both scriba and ui-designer use PostgreSQL  
✅ **Resource Efficiency**: One Docker container, shared resources  
✅ **Feature Parity**: JSON types, UUIDs, arrays all work correctly  
✅ **Production Ready**: Same database system in dev and production  
✅ **Proper Foreign Keys**: Referential integrity enforced  

## Default Admin User

- **Email**: raitsu11@gmail.com
- **Role**: admin
- **Table**: admin_roles (linked to users table)
- **Created**: Automatically during `pnpm db:init`

## Testing Checklist

After completing the setup steps above:

- [ ] Database connection works (`pnpm db:check` shows tables)
- [ ] Admin user exists (check admin_roles table)
- [ ] Can create a project via API
- [ ] Can list projects for a user
- [ ] Projects reference Maps correctly
- [ ] Frontend loads without database errors

## Troubleshooting

### Connection Refused
- PostgreSQL not running: `docker ps | grep postgres`
- Start it: `cd ../scriba-project/scriba/apps/web && docker-compose up -d postgres`

### Database Doesn't Exist
- Create it: `docker exec -it scriba-postgres psql -U postgres -c "CREATE DATABASE ui_designer_dev;"`

### Tables Already Exist
- Reset: `pnpm db:reset` (this runs purge + init)

### Environment Variables Not Loading
- Ensure `.env.local` exists in ui-designer root
- Restart dev server after creating .env.local

## Package Dependencies

### Already Installed ✅
- `pg` - PostgreSQL driver
- `@types/pg` - TypeScript types
- `dotenv` - Environment variables

### Should Remove 
- `sqlite3` - No longer needed (run `pnpm remove sqlite3`)

## Files Changed

| File | Status | Description |
|---|---|---|
| `lib/db/index.ts` | ✅ Modified | PostgreSQL connection |
| `.env.local` | ⚠️ Create | Database URL (gitignored) |
| `scripts/db-init.ts` | ✅ Modified | UI-Designer schema init |
| `scripts/db-check.ts` | ✅ Replaced | New UI-Designer version |
| `scripts/db-purge.ts` | ✅ Modified | Updated table list |
| `scripts/cleanup-temporary-documents.ts` | ✅ Deleted | Not needed |
| `DATABASE_SETUP.md` | ✅ Created | Setup documentation |

## Next Steps After Migration

1. Test project creation in the UI
2. Verify sidebar shows projects list
3. Test project CRUD operations
4. Confirm admin access for raitsu11@gmail.com
5. Consider migrating any important SQLite data if needed

## Rollback (If Needed)

If you need to rollback to SQLite:
1. Revert `lib/db/index.ts` using git
2. Reinstall sqlite3: `pnpm add sqlite3`
3. Remove `.env.local` changes
4. Restart dev server

---

**Status**: Migration implementation complete ✅  
**Action Required**: Create `.env.local` and run setup steps above  
**Documentation**: See [`DATABASE_SETUP.md`](DATABASE_SETUP.md) for details







