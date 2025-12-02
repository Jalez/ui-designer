/**
 * Utility functions for file service operations
 * Pure functions with no side effects
 */

/**
 * Check if a string is a valid UUID
 */
export function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Determine if a file ID is a UUID (database file) or a pathname (blob file)
 */
export function getFileIdType(fileId: string): "uuid" | "pathname" {
  return isUuid(fileId) ? "uuid" : "pathname";
}





