import Database from "better-sqlite3";
import path from "path";

// Database result types for abstraction
export type DatabaseResult = any[];

// Database client abstraction for SQLite
export interface DatabaseClient {
  query(sql: string, params?: unknown[]): Promise<DatabaseResult>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>;
  get(sql: string, params?: unknown[]): Promise<any>;
}

// Singleton database instance
let dbInstance: Database.Database | null = null;

function getDatabase(): Database.Database {
  if (!dbInstance) {
    const dbPath = path.join(process.cwd(), "db", "ui_designer_dev.sqlite");
    dbInstance = new Database(dbPath);
    
    // Enable foreign keys
    dbInstance.pragma("foreign_keys = ON");
  }
  
  return dbInstance;
}

// Create a promise-based wrapper for SQLite
export async function getSql(): Promise<DatabaseClient> {
  const db = getDatabase();
  
  return {
    query: async (sql: string, params?: unknown[]) => {
      try {
        const stmt = db.prepare(sql);
        return stmt.all(...(params || []));
      } catch (error) {
        console.error("Database query error:", error);
        throw error;
      }
    },
    
    run: async (sql: string, params?: unknown[]) => {
      try {
        const stmt = db.prepare(sql);
        const result = stmt.run(...(params || []));
        return {
          changes: result.changes,
          lastInsertRowid: Number(result.lastInsertRowid),
        };
      } catch (error) {
        console.error("Database run error:", error);
        throw error;
      }
    },
    
    get: async (sql: string, params?: unknown[]) => {
      try {
        const stmt = db.prepare(sql);
        return stmt.get(...(params || []));
      } catch (error) {
        console.error("Database get error:", error);
        throw error;
      }
    },
  };
}

// For backward compatibility, export sql as a function that returns the instance
export const sql = getSql;

// Direct access to the database (for synchronous operations)
export function getDb(): Database.Database {
  return getDatabase();
}

// Export default as the database instance
export default getDatabase();
