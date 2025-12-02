/**
 * SQL query functions for source file operations
 * Pure query builders that work with template literals
 */

import type { DatabaseClient } from "../../../db";
import { extractRows } from "../../../db/shared";

/**
 * Get source file metadata by ID
 */
export async function getSourceFileById(
  sqlInstance: DatabaseClient,
  id: string,
): Promise<{ file_path: string | null; document_id: string; user_id: string } | null> {
  const result = await sqlInstance`
    SELECT sf.file_path, sf.document_id, d.user_id
    FROM source_files sf
    INNER JOIN documents d ON sf.document_id = d.id
    WHERE sf.id = ${id}
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  return rows[0] as { file_path: string | null; document_id: string; user_id: string };
}

/**
 * Get source file by ID using parameterized query (for compatibility)
 */
export async function getSourceFileByIdParam(
  sqlInstance: DatabaseClient,
  id: string,
): Promise<{ file_path?: string; document_id?: string } | null> {
  const result = await sqlInstance.query(`SELECT file_path, document_id FROM source_files WHERE id = $1`, [id]);

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  return rows[0] as { file_path?: string; document_id?: string };
}

/**
 * Get document user ID
 */
export async function getDocumentUserId(sqlInstance: DatabaseClient, documentId: string): Promise<string | null> {
  const result = await sqlInstance.query(`SELECT user_id FROM documents WHERE id = $1`, [documentId]);
  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }
  return rows[0].user_id as string;
}

/**
 * Count source files for a document
 */
export async function countSourceFilesByDocument(sqlInstance: DatabaseClient, documentId: string): Promise<number> {
  const result = await sqlInstance`
    SELECT COUNT(*) as count FROM source_files WHERE document_id = ${documentId}
  `;

  const rows = extractRows(result);
  return parseInt(rows[0]?.count as string) || 0;
}

/**
 * Delete source files by blob path (with user authorization)
 */
export async function deleteSourceFilesByBlobPath(
  sqlInstance: DatabaseClient,
  blobPath: string,
  userId: string,
): Promise<number> {
  // Extract just the filename from the blob path for matching
  const blobFileName = blobPath.split("/").pop();

  // Try multiple matching strategies to find database records:
  // 1. Exact pathname match
  // 2. URL containing pathname (for full blob URLs)
  // 3. Filename match (in case path structure differs)
  const likePatternEnd = `%${blobPath}`; // Match URLs ending with the pathname
  const likePatternAny = `%${blobFileName}%`; // Match any path containing the filename

  const result = await sqlInstance.query(
    `
    DELETE FROM source_files
    WHERE (
      file_path = $1
      OR file_path LIKE $2
      OR file_path LIKE $3
      OR file_name = $4
    )
      AND document_id IN (
        SELECT id FROM documents WHERE user_id = $5
      )
  `,
    [blobPath, likePatternEnd, likePatternAny, blobFileName, userId],
  );

  return extractRows(result).length;
}

/**
 * Check if a blob path is still referenced in source_files
 */
export async function checkBlobReference(
  sqlInstance: DatabaseClient,
  blobPath: string,
  encodedPath: string,
  likeDecoded: string,
  likeEncoded: string,
): Promise<boolean> {
  const result = await sqlInstance`
    SELECT 1
    FROM source_files
    WHERE (
      file_path = ${blobPath}
      OR file_path = ${encodedPath}
      OR file_path LIKE ${likeDecoded}
      OR file_path LIKE ${likeEncoded}
    )
    LIMIT 1
  `;

  return extractRows(result).length > 0;
}
