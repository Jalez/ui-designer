#!/usr/bin/env tsx

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Pool } from "pg";
import journal from "../lib/db/migrations/meta/_journal.json";

config({ path: resolve(__dirname, "../.env.local") });

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL or POSTGRES_URL is required");
  process.exit(1);
}

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

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
    });

    child.on("error", rejectPromise);
  });
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
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
    const hasLegacyBootstrap = bootstrapCheck.rows[0]?.exists === true;

    if (hasLegacyBootstrap) {
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

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('"drizzle"."__drizzle_migrations"', 'id'),
        COALESCE((SELECT MAX(id) FROM "drizzle"."__drizzle_migrations"), 1),
        true
      )
    `);
  } finally {
    client.release();
    await pool.end();
  }

  await runCommand("npx", ["tsx", "scripts/run-drizzle-kit.ts", "migrate"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
