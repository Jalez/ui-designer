import { getSql, type DatabaseClient, type DatabaseResult } from ".";
import type { QueryResultRow } from "pg";

// Utility function to extract rows from database result
export function extractRows(result: DatabaseResult): QueryResultRow[] {
  if (Array.isArray(result)) {
    // Neon returns array of records directly
    return result as QueryResultRow[];
  } else if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: QueryResultRow[] }).rows)) {
    // PostgreSQL returns QueryResult with rows property
    return (result as { rows: QueryResultRow[] }).rows;
  }
  return [];
}

// Helper function to get sql instance
export async function getSqlInstance(): Promise<DatabaseClient> {
  return await getSql();
}
