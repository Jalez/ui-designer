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
  process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/ui_designer";

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

  const sqlDir = path.join(__dirname, "scripts", "sql");

  const required = [
    "users-schema.sql",
    "credits-schema.sql",
    "admin-schema.sql",
    "ui-designer-schema.sql",
    "projects-schema.sql",
    "webhook-schema.sql",
  ];

  const optional = [
    "groups-schema.sql",
    "games-migration.sql",
    "lti-credentials-schema.sql",
    "group-game-migration.sql",
    "game-collaboration-migration.sql",
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
    INSERT INTO maps (name, easy_level_points, medium_level_points, hard_level_points)
    VALUES ('all', 1, 2, 3)
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
