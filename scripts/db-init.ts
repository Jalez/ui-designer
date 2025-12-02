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
const DOCUMENTS_SCHEMA = resolve(SCRIPT_DIR, "sql/documents-schema.sql");
const CREDITS_SCHEMA = resolve(SCRIPT_DIR, "sql/credits-schema.sql");
const ADMIN_SCHEMA = resolve(SCRIPT_DIR, "sql/admin-schema.sql");
const WEBHOOK_SCHEMA = resolve(SCRIPT_DIR, "sql/webhook-schema.sql");
const AI_SCHEMA = resolve(SCRIPT_DIR, "sql/ai-schema.sql");

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
  const client = await pool.connect();

  try {
    console.log("🚀 INITIALIZING DATABASE...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("");

    // Step 1: Users schema (foundation for all other schemas)
    console.log("👤 Step 1/6: Applying users schema (user identification)...");
    const usersSQL = readFileSync(USERS_SCHEMA, "utf-8");
    await client.query(usersSQL);

    console.log("");
    console.log("📄 Step 2/6: Applying documents schema (documents, files, collaboration)...");
    const documentsSQL = readFileSync(DOCUMENTS_SCHEMA, "utf-8");
    await client.query(documentsSQL);

    console.log("");
    console.log("💳 Step 3/6: Applying credits schema (plans, credits, transactions)...");
    const creditsSQL = readFileSync(CREDITS_SCHEMA, "utf-8");
    await client.query(creditsSQL);

    console.log("");
    console.log("🔐 Step 4/6: Applying admin schema (admin users, access control)...");
    const adminSQL = readFileSync(ADMIN_SCHEMA, "utf-8");
    await client.query(adminSQL);

    console.log("");
    console.log("🪝 Step 5/6: Applying webhook schema (webhook processing, idempotency)...");
    const webhookSQL = readFileSync(WEBHOOK_SCHEMA, "utf-8");
    await client.query(webhookSQL);

    console.log("");
    console.log("🤖 Step 6/6: Applying AI schema (models, providers) [OPTIONAL]...");

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
