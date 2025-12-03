#!/usr/bin/env tsx

/**
 * Database Details Script
 * Shows detailed information about users, documents, and their relationships
 */

import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

const { Client } = pg;

// Load environment variables
config({ path: join(process.cwd(), ".env.local") });
config({ path: join(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!dbUrl) {
  console.error("❌ DATABASE_URL or POSTGRES_URL environment variable is required");
  process.exit(1);
}

console.log(`Using DATABASE_URL: ${dbUrl.replace(/:[^:@]+@/, ":****@")}`);

async function showDatabaseDetails() {
  const client = new Client({
    connectionString: dbUrl,
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Get all users with documents
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 USERS WITH DOCUMENTS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const docsResult = await client.query(`
      SELECT 
        user_id,
        COUNT(*) as document_count,
        MAX(updated_at) as last_updated
      FROM documents 
      GROUP BY user_id 
      ORDER BY document_count DESC
    `);
    console.table(docsResult.rows);

    // Get user plans
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("👥 USER PLANS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const plansResult = await client.query(`
      SELECT 
        user_email,
        plan_name,
        created_at,
        updated_at
      FROM user_plans
      ORDER BY created_at DESC
    `);
    console.table(plansResult.rows);

    // Get user credits
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("💰 USER CREDITS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const creditsResult = await client.query(`
      SELECT 
        user_email,
        current_credits,
        updated_at
      FROM user_credits
      ORDER BY current_credits DESC
    `);
    console.table(creditsResult.rows);

    // Get admin users
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔐 ADMIN USERS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const adminsResult = await client.query(`
      SELECT 
        email,
        role,
        is_active,
        granted_at,
        granted_by
      FROM admin_users
      ORDER BY granted_at DESC
    `);
    console.table(adminsResult.rows);

    // Combine all users
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 ALL USERS SUMMARY:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    const allUsersResult = await client.query(`
      SELECT 
        COALESCE(d.user_id, p.user_email, c.user_email) as email,
        COALESCE(d.doc_count, 0) as documents,
        p.plan_name,
        COALESCE(c.current_credits, 0) as credits,
        CASE 
          WHEN a.email IS NOT NULL THEN 'Yes'
          ELSE 'No'
        END as is_admin
      FROM (
        SELECT user_id, COUNT(*) as doc_count 
        FROM documents 
        GROUP BY user_id
      ) d
      FULL OUTER JOIN user_plans p ON d.user_id = p.user_email
      FULL OUTER JOIN user_credits c ON COALESCE(d.user_id, p.user_email) = c.user_email
      LEFT JOIN admin_users a ON COALESCE(d.user_id, p.user_email, c.user_email) = a.email AND a.is_active = true
      ORDER BY documents DESC, credits DESC
    `);
    console.table(allUsersResult.rows);

    // Get document details
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📄 ALL DOCUMENTS:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const documentsResult = await client.query(`
      SELECT 
        id,
        user_id,
        title,
        created_at,
        updated_at
      FROM documents
      ORDER BY updated_at DESC
    `);
    console.table(documentsResult.rows);

    // Summary
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📈 SUMMARY:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Total unique users (with docs):    ${docsResult.rows.length}`);
    console.log(`Total unique users (with plans):   ${plansResult.rows.length}`);
    console.log(`Total unique users (with credits): ${creditsResult.rows.length}`);
    console.log(`Total admin users:                 ${adminsResult.rows.length}`);
    console.log(`Total documents:                   ${documentsResult.rows.length}`);
    console.log(`Total unique users (all):          ${allUsersResult.rows.length}`);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n✅ Connection closed");
  }
}

showDatabaseDetails();
