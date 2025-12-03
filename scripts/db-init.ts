#!/usr/bin/env tsx

/**
 * Initialize the database with all schemas
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";
import * as dotenv from "dotenv";
import { Pool } from "pg";

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
const WEBHOOK_SCHEMA = resolve(SCRIPT_DIR, "sql/webhook-schema.sql");
const AI_SCHEMA = resolve(SCRIPT_DIR, "sql/ai-schema.sql");

// Extract database name from DATABASE_URL for creation check
const dbUrlMatch = DATABASE_URL.match(/\/([^/?]+)(\?|$)/);
const targetDbName = dbUrlMatch ? dbUrlMatch[1] : 'ui_designer_dev';

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

  try {
    console.log("");
    console.log("🚀 INITIALIZING UI-DESIGNER DATABASE...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    // Step 1: Users schema (foundation for all other schemas)
    console.log("👤 Step 1/7: Applying users schema (user identification)...");
    const usersSQL = readFileSync(USERS_SCHEMA, "utf-8");
    await client.query(usersSQL);

    console.log("");
    console.log("💳 Step 2/7: Applying credits schema (plans, credits, transactions)...");
    const creditsSQL = readFileSync(CREDITS_SCHEMA, "utf-8");
    await client.query(creditsSQL);

    console.log("");
    console.log("🔐 Step 3/7: Applying admin schema (admin users, access control)...");
    console.log("   (includes default admin: raitsu11@gmail.com)");
    const adminSQL = readFileSync(ADMIN_SCHEMA, "utf-8");
    await client.query(adminSQL);

    console.log("");
    console.log("🎮 Step 4/7: Applying UI Designer schema (levels, maps, sessions)...");
    const uiDesignerSQL = readFileSync(UI_DESIGNER_SCHEMA, "utf-8");
    await client.query(uiDesignerSQL);

    console.log("");
    console.log("🗂️  Step 5/7: Applying projects schema (projects table)...");
    const projectsSQL = readFileSync(PROJECTS_SCHEMA, "utf-8");
    await client.query(projectsSQL);

    console.log("");
    console.log("🪝 Step 6/7: Applying webhook schema (webhook processing, idempotency)...");
    const webhookSQL = readFileSync(WEBHOOK_SCHEMA, "utf-8");
    await client.query(webhookSQL);

    console.log("");
    console.log("🤖 Step 7/7: Applying AI schema (models, providers) [OPTIONAL]...");

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
        can_use_ai, 
        easy_level_points, 
        medium_level_points, 
        hard_level_points
      )
      VALUES ('all', 0, true, 10, 20, 30)
      ON CONFLICT (name) DO NOTHING
    `);
    
    console.log("✅ Default 'all' map created");

    console.log("");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✅ Database initialized successfully!");
    console.log("");
    console.log("💡 Run 'pnpm tsx scripts/db-check.ts' to verify the setup");
    console.log("");
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
