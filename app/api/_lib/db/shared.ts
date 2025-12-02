import { getSql, type DatabaseClient, type DatabaseResult } from ".";

// SQLite row type (any object)
type DatabaseRow = Record<string, any>;

// Utility function to extract rows from database result
export function extractRows(result: DatabaseResult): DatabaseRow[] {
  if (Array.isArray(result)) {
    return result as DatabaseRow[];
  }
  return [];
}

// Helper function to get sql instance
export async function getSqlInstance(): Promise<DatabaseClient> {
  return await getSql();
}
