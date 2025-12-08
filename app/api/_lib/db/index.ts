import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import type { QueryResult, QueryResultRow } from "pg";
import type { FullQueryResults, NeonQueryFunction } from "@neondatabase/serverless";

// Database result types for abstraction - using proper Neon types
type NeonQueryResult = FullQueryResults<false> | Record<string, any>[];
type PgQueryResult<R extends QueryResultRow = QueryResultRow> = QueryResult<R>;
export type DatabaseResult = NeonQueryResult | PgQueryResult;

// Database client abstraction with proper types
export interface DatabaseClient {
  query(sql: string, params?: unknown[]): Promise<DatabaseResult>;
  unsafe(rawQuery: string, params?: unknown[]): Promise<DatabaseResult>;
  // Template literal support
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<DatabaseResult>;
}

// Determine which client to use based on the database URL
function getDatabaseClient(databaseUrl: string): "neon" | "postgres" {
  // If it's localhost/127.0.0.1, use postgres client
  if (databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
    return "postgres";
  }
  // Otherwise use neon client
  return "neon";
}

// Create database client wrapper that provides consistent interface
function createDatabaseWrapper(client: any): DatabaseClient {
  if (client instanceof Pool) {
    // For pg Pool, create a callable function that handles template literals
    const wrapper = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.reduce((acc, str, i) => {
        return acc + str + (i < values.length ? `$${i + 1}` : "");
      }, "");
      return client.query(query, values);
    };

    // Add query method to the function
    (wrapper as DatabaseClient).query = (sql: string, params?: unknown[]) => client.query(sql, params);

    // Add unsafe method for raw SQL queries with parameterized values
    (wrapper as DatabaseClient).unsafe = (sql: string, params?: unknown[]) => {
      return client.query(sql, params || []);
    };

    return wrapper as DatabaseClient;
  } else {
    // Neon client already supports template literals and unsafe
    // Cast to DatabaseClient since NeonQueryFunction has compatible interface
    return client as any as DatabaseClient;
  }
}

// Singleton database instance
let dbInstance: DatabaseClient | null = null;

export async function getSql(): Promise<DatabaseClient> {
  if (!dbInstance) {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL or POSTGRES_URL environment variable is not set");
    }

    const clientType = getDatabaseClient(databaseUrl);

    if (clientType === "postgres") {
      const pool = new Pool({ connectionString: databaseUrl });
      dbInstance = createDatabaseWrapper(pool);

      // Set timezone to UTC
      try {
        await pool.query("SET TIMEZONE = 'UTC'");
      } catch (error) {
        console.warn("DB: CONNECTION-FAIL: Failed to set timezone to UTC. This often indicates the PostgreSQL Docker container is not running. Please check that your database container is started with 'docker-compose up' or similar command:", error);
      }
    } else {
      const neonClient = neon(databaseUrl);
      dbInstance = createDatabaseWrapper(neonClient);

      // Set timezone to UTC
      try {
        await neonClient`SET TIMEZONE = 'UTC'`;
      } catch (error) {
        console.warn("DB: CONNECTION-FAIL: Failed to set timezone to UTC. This often indicates the database connection is not available. Please check your database configuration:", error);
      }
    }
  }

  return dbInstance;
}

// For backward compatibility, export sql as a function that returns the instance
export const sql = getSql;

// Type definitions for database results
export interface DatabaseDocument {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  content_html: string | null;
  has_been_entered: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DatabaseDocumentPage {
  id: string;
  document_id: string;
  page_number: number;
  extracted_text: string | null;
  edited_content: string | null;
  highlight_color: string | null;
  sections: string[] | null;
  ocr_method: string | null;
  timestamp: Date;
}

export interface DatabaseSourceFile {
  id: string;
  document_id: string;
  file_type: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  file_path: string | null;
  drive_file_id: string | null;
  web_view_link: string | null;
  web_content_link: string | null;
  timestamp: Date;
}
