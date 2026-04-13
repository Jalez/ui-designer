#!/usr/bin/env node
// Plain ESM script — no TypeScript compilation needed.
// Runs SQL schema files in order against the Docker PostgreSQL container.

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/hello_ui";

const pool = new Pool({ connectionString: DATABASE_URL });

async function runSql(filePath, optional = false) {
  const label = path.basename(filePath);
  if (!fs.existsSync(filePath)) {
    if (optional) {
      console.log(`  [skip]  ${label} (not found, optional)`);
      return;
    }
    throw new Error(`Required SQL file not found: ${filePath}`);
  }
  const sql = fs.readFileSync(filePath, "utf8");
  await pool.query(sql);
  console.log(`  [ok]    ${label}`);
}

async function main() {
  console.log("DB-INIT: connecting to", DATABASE_URL.replace(/:([^:@]+)@/, ":***@"));

  const client = await pool.connect();
  await client.query("SELECT 1");
  client.release();
  console.log("DB-INIT: connected\n");

  // Enable pgcrypto for gen_random_uuid() on older Postgres versions
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  console.log("  [ok]    pgcrypto extension enabled\n");

  const sqlDir = path.join(__dirname, "scripts", "sql");

  // Pre-migrations: run before main schemas to handle column renames
  // so that ADD COLUMN IF NOT EXISTS in the schema files is a no-op.
  const preMigrations = [
    "duplicate-users-migration.sql",
  ];

  for (const file of preMigrations) {
    const filePath = path.join(sqlDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const sql = fs.readFileSync(filePath, "utf8");
        await pool.query(sql);
        console.log(`  [ok]    ${file} (pre-migration)`);
      } catch {
        // Table may not exist yet on fresh install — that's fine
        console.log(`  [skip]  ${file} (pre-migration, table not ready)`);
      }
    }
  }

  const required = [
    "users-schema.sql",
    "credits-schema.sql",
    "admin-schema.sql",
    "ui-designer-schema.sql",
    "drop-map-level-points.sql",
    "projects-schema.sql",
    "webhook-schema.sql",
  ];

  // Drizzle migrations under lib/db/migrations/ own: game runtime columns (0000), projects.group_id + lti_credentials (0001).
  // After SQL bootstrap, run `pnpm db:migrate` (production does this from the app image).
  const optional = [
    "groups-schema.sql",
    "game-statistics-schema.sql",
    "games-migration.sql",
    "game-collaboration-migration.sql",
    "game-instances-migration.sql",
    "ai-schema.sql",
  ];

  console.log("Running required schemas:");
  for (const file of required) {
    await runSql(path.join(sqlDir, file));
  }

  console.log("\nRunning optional schemas:");
  for (const file of optional) {
    await runSql(path.join(sqlDir, file), true);
  }

  // Seed: ensure default map entry exists
  console.log("\nSeeding default map entry...");
  await pool.query(`
    INSERT INTO maps (name, random, can_use_ai)
    VALUES ('all', 0, true)
    ON CONFLICT (name) DO NOTHING
  `);
  console.log("  [ok]    default map 'all'");

  await pool.end();
  console.log("\nDB-INIT: complete");
}

main().catch((err) => {
  console.error("DB-INIT: FAILED:", err.message);
  process.exit(1);
});
