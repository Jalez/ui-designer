#!/usr/bin/env tsx

/**
 * Initialize the database with all schemas
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";
import { spawn } from "node:child_process";
import * as dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";
import journal from "../lib/db/migrations/meta/_journal.json";

// Check for -y flag
const skipPrompts = process.argv.includes("-y") || process.argv.includes("--yes");

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL not found in environment");
  process.exit(1);
}

const SCRIPT_DIR = __dirname;
const USERS_SCHEMA = resolve(SCRIPT_DIR, "sql/users-schema.sql");
const CREDITS_SCHEMA = resolve(SCRIPT_DIR, "sql/credits-schema.sql");
const ADMIN_SCHEMA = resolve(SCRIPT_DIR, "sql/admin-schema.sql");
const PROJECTS_SCHEMA = resolve(SCRIPT_DIR, "sql/projects-schema.sql");
const UI_DESIGNER_SCHEMA = resolve(SCRIPT_DIR, "sql/ui-designer-schema.sql");
const GROUPS_SCHEMA = resolve(SCRIPT_DIR, "sql/groups-schema.sql");
const GAME_STATISTICS_SCHEMA = resolve(SCRIPT_DIR, "sql/game-statistics-schema.sql");
const WEBHOOK_SCHEMA = resolve(SCRIPT_DIR, "sql/webhook-schema.sql");
const AI_SCHEMA = resolve(SCRIPT_DIR, "sql/ai-schema.sql");
const LTI_CREDENTIALS_SCHEMA = resolve(SCRIPT_DIR, "sql/lti-credentials-schema.sql");
const DROP_MAP_LEVEL_POINTS_MIGRATION = resolve(SCRIPT_DIR, "sql/drop-map-level-points.sql");
const DUPLICATE_USERS_MIGRATION = resolve(SCRIPT_DIR, "sql/duplicate-users-migration.sql");
const BASELINE_TAGS = new Set([
  "0000_game_runtime_drawboard_settings",
  "0001_projects_group_id_lti_credentials",
  "0002_amusing_cassandra_nova",
  "0003_user_tour_spot_ack",
]);

type JournalEntry = {
  tag: string;
  when: number;
};

// Extract database name from DATABASE_URL for creation check
const dbUrlMatch = DATABASE_URL.match(/\/([^/?]+)(\?|$)/);
const targetDbName = dbUrlMatch ? dbUrlMatch[1] : "hello_ui";

// Create connection to postgres database (default) for database creation
const postgresUrl = DATABASE_URL.replace(/\/[^/?]+(\?|$)/, '/postgres$1');

async function ensureDatabaseExists() {
  const tempPool = new Pool({ connectionString: postgresUrl });
  const client = await tempPool.connect();
  
  try {
    // Check if database exists
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );
    
    if (result.rows.length === 0) {
      console.log(`📦 Database '${targetDbName}' does not exist. Creating...`);
      // Use identifier quoting to handle database names with special characters
      await client.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`✅ Database '${targetDbName}' created successfully!`);
    } else {
      console.log(`✅ Database '${targetDbName}' already exists.`);
    }
  } finally {
    client.release();
    await tempPool.end();
  }
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function runDrizzleMigrate() {
  console.log("");
  console.log("🧭 Applying Drizzle migrations...");

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(
      "npx",
      ["tsx", "scripts/run-drizzle-kit.ts", "migrate"],
      {
        cwd: resolve(__dirname, ".."),
        stdio: "inherit",
        env: process.env,
        shell: process.platform === "win32",
      },
    );

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`Drizzle migrate failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", rejectPromise);
  });

  console.log("✅ Drizzle migrations applied");
}

async function baselineLegacyDrizzleMigrations(client: PoolClient) {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const bootstrapCheck = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admin_roles'
    ) AS exists
  `);

  if (bootstrapCheck.rows[0]?.exists !== true) {
    return;
  }

  await client.query(`
    ALTER TABLE "projects"
      ADD COLUMN IF NOT EXISTS "drawboard_capture_mode" text NOT NULL DEFAULT 'browser',
      ADD COLUMN IF NOT EXISTS "manual_drawboard_capture" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "remote_sync_debounce_ms" integer NOT NULL DEFAULT 500,
      ADD COLUMN IF NOT EXISTS "drawboard_reload_debounce_ms" integer NOT NULL DEFAULT 48,
      ADD COLUMN IF NOT EXISTS "group_id" uuid
  `);
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'groups'
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'projects_group_id_groups_id_fk'
      ) THEN
        ALTER TABLE "projects"
          ADD CONSTRAINT "projects_group_id_groups_id_fk"
          FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL;
      END IF;
    END $$;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_projects_group_id"
    ON "projects" USING btree ("group_id")
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "lti_credentials" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "consumer_key" text NOT NULL,
      "consumer_secret" text NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "lti_credentials_user_id_key" UNIQUE ("user_id"),
      CONSTRAINT "lti_credentials_consumer_key_key" UNIQUE ("consumer_key")
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_lti_credentials_consumer_key"
    ON "lti_credentials" USING btree ("consumer_key")
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_lti_credentials_user_id"
    ON "lti_credentials" USING btree ("user_id")
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "user_tour_spot_ack" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "spot_key" text NOT NULL,
      "version_seen" integer NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "user_tour_spot_ack_user_id_spot_key_pk" PRIMARY KEY("user_id","spot_key")
    )
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS "idx_user_tour_spot_ack_user_id"
    ON "user_tour_spot_ack" USING btree ("user_id")
  `);

  const entries = (journal.entries as JournalEntry[]).filter((entry) => BASELINE_TAGS.has(entry.tag));
  for (const entry of entries) {
    await client.query(
      `
        INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
        SELECT $1, $2
        WHERE NOT EXISTS (
          SELECT 1
          FROM "drizzle"."__drizzle_migrations"
          WHERE created_at = $2
        )
      `,
      [`baseline:${entry.tag}`, entry.when],
    );
  }
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    }),
  );
}

async function initializeDatabase() {
  // First, ensure the database exists
  await ensureDatabaseExists();
  
  const client = await pool.connect();
  let released = false;

  try {
    console.log("");
    console.log("🚀 INITIALIZING UI-DESIGNER DATABASE...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    // Step 1: Users schema (foundation for all other schemas)
    console.log("👤 Step 1/9: Applying users schema (user identification)...");
    const usersSQL = readFileSync(USERS_SCHEMA, "utf-8");
    await client.query(usersSQL);

    console.log("");
    console.log("💳 Step 2/9: Applying credits schema (plans, credits, transactions)...");
    const creditsSQL = readFileSync(CREDITS_SCHEMA, "utf-8");
    await client.query(creditsSQL);

    console.log("");
    console.log("🔐 Step 3/9: Applying admin schema (admin users, access control)...");
    console.log("   (includes default admin: raitsu11@gmail.com)");
    const adminSQL = readFileSync(ADMIN_SCHEMA, "utf-8");
    await client.query(adminSQL);

    console.log("");
    console.log("🎮 Step 4/9: Applying UI Designer schema (levels, maps, sessions)...");
    const uiDesignerSQL = readFileSync(UI_DESIGNER_SCHEMA, "utf-8");
    await client.query(uiDesignerSQL);
    const dropMapLevelPointsSQL = readFileSync(DROP_MAP_LEVEL_POINTS_MIGRATION, "utf-8");
    await client.query(dropMapLevelPointsSQL);

    console.log("");
    console.log("🗂️  Step 5/9: Applying projects schema (projects table)...");
    const duplicateUsersMigrationSQL = readFileSync(DUPLICATE_USERS_MIGRATION, "utf-8");
    // Run column rename migration before projects-schema.sql so ADD COLUMN IF NOT EXISTS is a no-op
    try { await client.query(duplicateUsersMigrationSQL); } catch { /* table may not exist yet */ }
    const projectsSQL = readFileSync(PROJECTS_SCHEMA, "utf-8");
    await client.query(projectsSQL);

    console.log("");
    console.log("👥 Step 6/9: Applying groups schema (collaboration, LTI)...");
    const groupsSQL = readFileSync(GROUPS_SCHEMA, "utf-8");
    await client.query(groupsSQL);

    console.log("");
    console.log("📊 Step 7/10: Applying game statistics schema (leaderboards, analytics)...");
    const gameStatisticsSQL = readFileSync(GAME_STATISTICS_SCHEMA, "utf-8");
    await client.query(gameStatisticsSQL);

    console.log("");
    console.log("🪝 Step 8/10: Applying webhook schema (webhook processing, idempotency)...");
    const webhookSQL = readFileSync(WEBHOOK_SCHEMA, "utf-8");
    await client.query(webhookSQL);

    console.log("");
    console.log("🔑 Step 9/10: Applying LTI credentials schema (per-user LTI keys) [OPTIONAL]...");

    try {
      const ltiCredentialsSQL = readFileSync(LTI_CREDENTIALS_SCHEMA, "utf-8");
      await client.query(ltiCredentialsSQL);
      console.log("✅ LTI credentials schema applied");
    } catch (error: unknown) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : null;
      if (error instanceof Error && code === "ENOENT") {
        console.log("⏭️  LTI credentials schema file not found, skipping...");
      } else {
        throw error;
      }
    }

    console.log("");
    console.log("🤖 Step 10/10: Applying AI schema (models, providers) [OPTIONAL]...");

    try {
      const aiSQL = readFileSync(AI_SCHEMA, "utf-8");
      const shouldApplyAI = skipPrompts || (await askQuestion("Apply AI schema? (y/N) ")).toLowerCase().startsWith("y");

      if (shouldApplyAI) {
        await client.query(aiSQL);
        console.log("✅ AI schema applied");

        // Add Google OCR services
        console.log("");
        console.log("📝 Adding Google OCR services...");

        // Insert Google provider
        await client.query(`
          INSERT INTO ai_providers (name, slug, privacy_policy_url, is_active)
          VALUES ('Google Cloud', 'google', 'https://cloud.google.com/terms/cloud-privacy-notice', true)
          ON CONFLICT (slug) DO NOTHING
        `);

        // Insert Google Cloud Vision API model
        // Pricing: $1.50 per 1000 images (first 1000/month free)
        // Average cost per image: $0.0015
        await client.query(`
          INSERT INTO ai_models (
            model_id, name, provider_slug, description,
            modalities, image_price, is_active
          )
          VALUES (
            'google-vision', 
            'Google Cloud Vision API', 
            'google',
            'Google Cloud Vision API for OCR and image analysis',
            ARRAY['image->text'],
            0.0015,
            true
          )
          ON CONFLICT (model_id) DO NOTHING
        `);

        // Insert Google Document AI model
        // Pricing: $65 per 1000 pages
        // Average cost per page: $0.065
        await client.query(`
          INSERT INTO ai_models (
            model_id, name, provider_slug, description,
            modalities, image_price, is_active
          )
          VALUES (
            'document-ai', 
            'Google Document AI', 
            'google',
            'Google Document AI for advanced document OCR and processing',
            ARRAY['image->text', 'document->text'],
            0.065,
            true
          )
          ON CONFLICT (model_id) DO NOTHING
        `);

        // Add OpenAI provider and models
        console.log("");
        console.log("🤖 Adding OpenAI services...");

        // Insert OpenAI provider
        await client.query(`
          INSERT INTO ai_providers (name, slug, privacy_policy_url, terms_of_service_url, is_active)
          VALUES ('OpenAI', 'openai', 'https://openai.com/policies/privacy-policy', 'https://openai.com/policies/terms-of-use', true)
          ON CONFLICT (slug) DO NOTHING
        `);

        // Insert GPT Image 1 model
        // Pricing based on quality tiers (using medium quality as default)
        await client.query(`
          INSERT INTO ai_models (
            model_id, name, provider_slug, description,
            context_length, modalities, image_price, is_active
          )
          VALUES (
            'gpt-image-1',
            'GPT Image 1',
            'openai',
            'OpenAI state-of-the-art image generation model with multimodal capabilities',
            4096,
            ARRAY['text->image, image->image'],
            0.042, -- Medium quality 1024x1024 price per image
            true
          )
          ON CONFLICT (model_id) DO NOTHING
        `);

        console.log("✅ OpenAI services added");
      } else {
        console.log("⏭️  Skipped AI schema (currently using JSON files)");
      }
    } catch (error: unknown) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        console.log("⏭️  AI schema file not found, skipping...");
      } else {
        throw error;
      }
    }

    console.log("");
    console.log("🎮 Creating default 'all' map for UI Designer...");
    
    // Create default "all" map that the UI uses
    await client.query(`
      INSERT INTO maps (
        name, 
        random, 
        can_use_ai
      )
      VALUES ('all', 0, true)
      ON CONFLICT (name) DO NOTHING
    `);
    
    console.log("✅ Default 'all' map created");

    console.log("");
    console.log("🧭 Baselining legacy Drizzle migrations...");
    await baselineLegacyDrizzleMigrations(client);
    console.log("✅ Legacy Drizzle migration baseline prepared");

    await client.release();
    released = true;
    await pool.end();
    await runDrizzleMigrate();

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Database initialized successfully!");
    console.log("");
    console.log("💡 Next: `pnpm db:verify-migrations` and `pnpm db:check`");
    console.log("");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  } finally {
    if (!released) {
      client.release();
      released = true;
    }
    await pool.end().catch(() => {});
  }
}

initializeDatabase().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
