/**
 * Repository for source file database operations
 */

import { extractRows, getSqlInstance } from "../../../db/shared";
import { encodeBlobPath } from "../blobStorageService/blobPathUtils";
import * as queries from "./sourceFileQueries";
import type { ISourceFileRepository, SourceFileMetadata } from "./types";

export class SourceFileRepository implements ISourceFileRepository {
  /**
   * Get source file metadata by ID
   */
  async getById(id: string): Promise<SourceFileMetadata | null> {
    const sqlInstance = await getSqlInstance();
    const result = await queries.getSourceFileById(sqlInstance, id);

    if (!result) {
      return null;
    }

    return {
      id,
      file_path: result.file_path,
      document_id: result.document_id,
      user_id: result.user_id,
    };
  }

  /**
   * Delete a source file by ID
   */
  async delete(id: string): Promise<void> {
    const sqlInstance = await getSqlInstance();
    await sqlInstance`
      DELETE FROM source_files WHERE id = ${id}
    `;
  }

  /**
   * Delete all source files for a document
   * Returns the count of deleted files
   */
  async deleteByDocumentId(documentId: string): Promise<number> {
    const sqlInstance = await getSqlInstance();

    // For Neon compatibility, count first then delete
    const count = await queries.countSourceFilesByDocument(sqlInstance, documentId);

    await sqlInstance`
      DELETE FROM source_files WHERE document_id = ${documentId}
    `;

    return count;
  }

  /**
   * Delete source files by type for a document
   */
  async deleteByType(documentId: string, fileType: string): Promise<number> {
    const sqlInstance = await getSqlInstance();
    const result = await sqlInstance`
      DELETE FROM source_files
      WHERE document_id = ${documentId} AND file_type = ${fileType}
    `;

    return extractRows(result).length;
  }

  /**
   * Cleanup duplicate source files for a document
   * Keeps the most recent one of each duplicate group
   */
  async cleanupDuplicates(documentId: string): Promise<number> {
    const sqlInstance = await getSqlInstance();

    // Use a CTE to identify and delete duplicates, keeping the most recent one
    const result = await sqlInstance`
      WITH duplicates AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY document_id, file_type, file_name,
                 COALESCE(file_path, ''), COALESCE(drive_file_id, '')
                 ORDER BY created_at DESC
               ) as rn
        FROM source_files
        WHERE document_id = ${documentId}
      )
      DELETE FROM source_files
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
    `;

    return extractRows(result).length || 0;
  }

  /**
   * Check if a blob path is still referenced in the database
   */
  async isBlobReferenced(blobPath: string): Promise<boolean> {
    const sqlInstance = await getSqlInstance();
    const encodedPath = encodeBlobPath(blobPath);
    const likeDecoded = `%${blobPath}`;
    const likeEncoded = `%${encodedPath}`;

    return await queries.checkBlobReference(sqlInstance, blobPath, encodedPath, likeDecoded, likeEncoded);
  }

  /**
   * Delete source files by blob path (with user authorization)
   */
  async deleteByBlobPath(blobPath: string, userId: string): Promise<number> {
    const sqlInstance = await getSqlInstance();
    return await queries.deleteSourceFilesByBlobPath(sqlInstance, blobPath, userId);
  }
}

let defaultRepository: ISourceFileRepository | null = null;

/**
 * Get the default repository instance
 */
export function getSourceFileRepository(): ISourceFileRepository {
  if (!defaultRepository) {
    defaultRepository = new SourceFileRepository();
  }
  return defaultRepository;
}

/**
 * Create a repository instance
 * Useful for dependency injection in tests
 */
export function createSourceFileRepository(): ISourceFileRepository {
  return new SourceFileRepository();
}




