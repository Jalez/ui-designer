# Database Management Scripts

Shell scripts for managing the Scriba PostgreSQL database.

## Quick Start

```bash
# 1. Purge everything (⚠️ destructive!)
./db-purge.sh

# 2. Initialize with both schemas
./db-init.sh

# 3. Verify the setup
./db-check.sh
```

## Scripts

### `db-purge.sh` 🗑️
Drops all tables from the database (both document and credit system tables).

**Warning**: This is destructive! All data will be lost.

```bash
./db-purge.sh
```

### `db-init.sh` 🚀
Initializes the database by applying both schemas in order:
1. Documents schema (documents, pages, files, collaboration)
2. Credits schema (plans, credits, services, transactions)

```bash
./db-init.sh
```

### `db-check.sh` 🔍
Displays comprehensive information about the current database state:
- All tables with row counts
- Plan configurations
- Service costs
- User statistics
- Recent transactions
- Admin users
- Database indexes

```bash
./db-check.sh
```

## SQL Schemas

All SQL schema files are in the `sql/` directory:

- **`documents-schema.sql`** - Document management and collaboration
- **`credits-schema.sql`** - Credit system and billing

See [`sql/README.md`](./sql/README.md) for detailed documentation.

## Environment

Scripts automatically load environment variables from:
```
../env.development.local
```

Required variable:
- `DATABASE_URL` - PostgreSQL connection string

## Development Workflow

### Fresh Start
```bash
./db-purge.sh && ./db-init.sh && ./db-check.sh
```

### Check Status
```bash
./db-check.sh
```

### Modify Schema
1. Edit the appropriate file in `sql/`
2. Purge: `./db-purge.sh`
3. Reinitialize: `./db-init.sh`
4. Verify: `./db-check.sh`

## Notes

- Scripts use `set -e` to exit on any error
- All scripts check for `DATABASE_URL` before executing
- Scripts are idempotent where possible (using `IF NOT EXISTS`, `ON CONFLICT`, etc.)
- In production, use proper migrations instead of purge/init!

## Troubleshooting

**"DATABASE_URL not found"**
- Make sure `.env.development.local` exists in the `apps/web` directory
- Verify it contains a valid `DATABASE_URL`

**"psql: command not found"**
- Install PostgreSQL client tools: `brew install postgresql`

**Connection refused**
- Check if database server is running
- Verify DATABASE_URL is correct
