# UI-Designer PostgreSQL Database Setup

## Architecture

**Shared PostgreSQL Instance**
- **Container**: Single PostgreSQL Docker instance (shared with Scriba)
- **Databases**: 
  - `scriba_dev` - Scriba application
  - `ui_designer_dev` - UI Designer application (this app)

## Prerequisites

1. PostgreSQL Docker container must be running (from Scriba setup)
2. `pg` npm package installed (already in package.json)
3. `.env.local` file configured with DATABASE_URL

## Quick Start

### 1. Start PostgreSQL Container

From the Scriba directory:
```bash
cd ../scriba-project/scriba/apps/web
docker-compose up -d postgres
```

Or if PostgreSQL is already running, verify it:
```bash
docker ps | grep postgres
```

### 2. Create UI-Designer Database

Connect to the PostgreSQL container and create the database:
```bash
# Connect to PostgreSQL
docker exec -it scriba-postgres psql -U postgres

# Create database
CREATE DATABASE ui_designer_dev;

# Verify it was created
\l

# Exit
\q
```

### 3. Configure Environment

Create `.env.local` in the ui-designer root directory:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ui_designer_dev
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
```

### 4. Initialize Database Schema

Run the initialization script:
```bash
pnpm tsx scripts/db-init.ts -y
```

Or interactively (will prompt for AI schema):
```bash
pnpm tsx scripts/db-init.ts
```

### 5. Verify Setup

Check that all tables were created correctly:
```bash
pnpm tsx scripts/db-check.ts
```

### 6. Remove SQLite Dependency

Since we've migrated to PostgreSQL:
```bash
pnpm remove sqlite3
```

## Database Management

### Available Commands

| Command | Purpose |
|---|---|
| `pnpm db:check` | Check database state and tables |
| `pnpm db:purge` | Drop all tables (⚠️ destructive) |
| `pnpm db:init` | Initialize/recreate schema |
| `pnpm db:reset` | Complete reset (purge + init) |

### Development Workflow

```bash
# Check current state
pnpm db:check

# If needed, reset everything
pnpm db:reset

# Verify
pnpm db:check
```

## Schema Overview

UI-Designer uses the following schemas:

1. **users-schema.sql** - User accounts (NextAuth)
2. **credits-schema.sql** - Credit system and transactions
3. **admin-schema.sql** - Admin access control (includes raitsu11@gmail.com)
4. **projects-schema.sql** - Maps, Levels, and user Projects
5. **webhook-schema.sql** - Stripe webhook processing
6. **ai-schema.sql** - AI models and providers (optional)

## Tables

### Core Tables
- `users` - User accounts
- `Maps` - System-level challenge maps
- `Levels` - System-level challenge levels
- `MapLevels` - Many-to-many join table
- `Projects` - User-owned saved progress on maps

### Admin & Credits
- `admin_roles` - Admin user assignments
- `user_credits` - Credit balances
- `credit_transactions` - Transaction history

### Webhooks & AI
- `webhook_events` - Stripe webhook events
- `ai_providers` - AI service providers (optional)
- `ai_models` - AI models (optional)

## Troubleshooting

### Connection Refused

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running, start it from Scriba directory
cd ../scriba-project/scriba/apps/web
docker-compose up -d postgres
```

### Database Doesn't Exist

```bash
# Create it
docker exec -it scriba-postgres psql -U postgres -c "CREATE DATABASE ui_designer_dev;"
```

### Tables Already Exist

```bash
# Reset everything
pnpm db:purge
pnpm db:init -y
```

### Wrong Credentials

Verify your `.env.local` has the correct connection string:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ui_designer_dev
```

## Production Considerations

For production deployment:

1. **Use Environment Variables**: Set `DATABASE_URL` in your hosting platform
2. **Use Strong Credentials**: Don't use `postgres/postgres` in production
3. **Enable SSL**: Add `?sslmode=require` to DATABASE_URL
4. **Connection Pooling**: Already configured in `lib/db/index.ts`
5. **Backup Strategy**: Set up regular backups
6. **Monitoring**: Monitor connection pool usage

## Migration from SQLite

If you had existing SQLite data:

1. **Backup SQLite Data**: Copy `db/ui_designer_dev.sqlite` 
2. **Export Important Data**: Export any critical maps/levels
3. **Follow Setup Steps**: Create PostgreSQL database and initialize
4. **Reimport Data**: Manually add any critical data back
5. **Test Thoroughly**: Verify all functionality works
6. **Remove SQLite**: Run `pnpm remove sqlite3` and remove old db file

## Admin Access

Default admin user:
- **Email**: raitsu11@gmail.com
- **Role**: admin
- **Created**: Automatically during schema initialization

To add more admins, insert into `admin_roles` table after creating the user in `users` table.

## Additional Resources

- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Sequelize Documentation](https://sequelize.org/docs/v6/)
- [pg npm package](https://node-postgres.com/)

