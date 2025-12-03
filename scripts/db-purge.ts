#!/usr/bin/env tsx

/**
 * Purge (drop all tables) from the database
 */

import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { Pool } from "pg";

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL not found in environment");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function purgeDatabase() {
  const client = await pool.connect();

  try {
    console.log("🗑️  PURGING UI-DESIGNER DATABASE...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    await client.query(`
      -- Drop all tables (CASCADE will drop dependent objects)

      -- Projects schema tables (both quoted and unquoted versions from previous runs)
      DROP TABLE IF EXISTS "Projects" CASCADE;
      DROP TABLE IF EXISTS projects CASCADE;
      DROP TABLE IF EXISTS "MapLevels" CASCADE;
      DROP TABLE IF EXISTS maplevels CASCADE;
      DROP TABLE IF EXISTS "Levels" CASCADE;
      DROP TABLE IF EXISTS levels CASCADE;
      DROP TABLE IF EXISTS "Maps" CASCADE;
      DROP TABLE IF EXISTS maps CASCADE;

      -- Credits schema tables
      DROP TABLE IF EXISTS credit_transactions CASCADE;
      DROP TABLE IF EXISTS user_credits CASCADE;

      -- Admin schema tables
      DROP TABLE IF EXISTS admin_roles CASCADE;

      -- Webhook schema tables
      DROP TABLE IF EXISTS webhook_idempotency CASCADE;

      -- AI schema tables (if they exist)
      DROP TABLE IF EXISTS user_default_models CASCADE;
      DROP TABLE IF EXISTS model_usage_analytics CASCADE;
      DROP TABLE IF EXISTS ai_models CASCADE;
      DROP TABLE IF EXISTS ai_providers CASCADE;

      -- Users schema tables (drop last due to foreign keys)
      DROP TABLE IF EXISTS users CASCADE;

      -- Drop functions
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
      DROP FUNCTION IF EXISTS get_or_create_user_id(text) CASCADE;
      DROP FUNCTION IF EXISTS get_user_email(uuid) CASCADE;

      -- Drop extensions (optional - usually keep these)
      -- DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
    `);

    console.log("✅ All tables and functions dropped successfully");
    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Database purged successfully!");
    console.log("");
  } catch (error) {
    console.error("❌ Error purging database:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

purgeDatabase().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
