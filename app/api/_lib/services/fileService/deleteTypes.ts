/**
 * Types for delete operations
 */

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  success: boolean;
  error?: string;
}

/**
 * Result of a batch delete operation
 */
export interface BatchDeleteResult {
  deletedCount: number;
  failedIds: string[];
}




