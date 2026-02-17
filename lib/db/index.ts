import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

function getDatabaseClientType(databaseUrl: string): "neon" | "postgres" {
  // Allow explicit override via DB_CLIENT env var (e.g. Docker sets DB_CLIENT=postgres)
  const override = process.env.DB_CLIENT;
  if (override === "postgres" || override === "neon") {
    return override;
  }
  if (databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
    return "postgres";
  }
  return "neon";
}

type DrizzleDb = ReturnType<typeof drizzleNeonHttp> | ReturnType<typeof drizzleNodePostgres>;

let db: DrizzleDb | null = null;
let pool: Pool | null = null;

export function getDb(): DrizzleDb {
  if (db) return db;

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL environment variable is not set");
  }

  const clientType = getDatabaseClientType(databaseUrl);

  if (clientType === "postgres") {
    pool = new Pool({ connectionString: databaseUrl });
    db = drizzleNodePostgres(pool, { schema });
  } else {
    const sql = neon(databaseUrl);
    db = drizzleNeonHttp(sql, { schema });
  }

  return db;
}

export { schema };

export async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
