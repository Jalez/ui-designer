#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL not found in environment");
  process.exit(1);
}

const GROUPS_SCHEMA = resolve(__dirname, "sql/groups-schema.sql");

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function applyGroupsSchema() {
  const client = await pool.connect();

  try {
    console.log("👥 Applying groups schema...");
    const groupsSQL = readFileSync(GROUPS_SCHEMA, "utf-8");
    await client.query(groupsSQL);
    console.log("✅ Groups schema applied successfully!");
  } catch (error) {
    console.error("❌ Error applying groups schema:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyGroupsSchema().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
