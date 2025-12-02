import { del, list } from "@vercel/blob";
import { getSqlInstance, extractRows } from "../../db/shared";
import { getUserEmail } from "../userService";

// Delete a single source file
export async function deleteSourceFile(id: string): Promise<boolean> {
  const sqlInstance = await getSqlInstance();

  try {
    const fileResult = await sqlInstance`
      SELECT sf.file_path, sf.document_id, d.user_id
      FROM source_files sf
      INNER JOIN documents d ON sf.document_id = d.id
      WHERE sf.id = ${id}
    `;
    const fileRows = extractRows(fileResult);
    const fileMetadata = fileRows[0] as { file_path?: string | null; user_id?: string | null } | undefined;

    if (!fileMetadata) {
      console.warn("FILE-DELETE: Source file not found for deletion:", id);
      return false;
    }

    await sqlInstance`
      DELETE FROM source_files WHERE id = ${id}
    `;

    const blobPath = normalizeBlobPath(fileMetadata.file_path);

    if (blobPath && process.env.BLOB_READ_WRITE_TOKEN) {
      const stillReferenced = await isBlobStillReferenced(sqlInstance, blobPath);

      if (!stillReferenced) {
        await deleteBlobIfExists(blobPath);
      } else {
        console.log("FILE-DELETE: Blob still referenced, skipping deletion:", blobPath);
      }
    }

    return true;
  } catch (error) {
    console.error("FILE-DELETE: Failed to delete source file:", id, error);
    return false;
  }
}

// Delete multiple source files
export async function deleteSourceFiles(ids: string[]): Promise<{ deletedCount: number; failedIds: string[] }> {
  const failedIds: string[] = [];
  let deletedCount = 0;

  for (const id of ids) {
    try {
      const deleted = await deleteSourceFile(id);
      if (deleted) {
        deletedCount++;
      } else {
        failedIds.push(id);
      }
    } catch (error) {
      console.error(`Failed to delete source file ${id}:`, error);
      failedIds.push(id);
    }
  }

  return { deletedCount, failedIds };
}

// Delete all source files for a document
export async function deleteSourceFilesForDocument(documentId: string): Promise<number> {
  const sqlInstance = await getSqlInstance();

  // For Neon compatibility, count first then delete
  const countResult = await sqlInstance`
    SELECT COUNT(*) as count FROM source_files WHERE document_id = ${documentId}
  `;

  const countRows = extractRows(countResult);
  const initialCount = parseInt(countRows[0]?.count as string) || 0;

  await sqlInstance`
    DELETE FROM source_files WHERE document_id = ${documentId}
  `;

  // Return the count that was deleted (approximate)
  return initialCount;
}
// Delete duplicate source files for a document (cleanup operation)
export async function cleanupDuplicateSourceFiles(documentId: string): Promise<number> {
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

// Delete source files by type for a document
export async function deleteSourceFilesByType(documentId: string, fileType: string): Promise<number> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
    DELETE FROM source_files
    WHERE document_id = ${documentId} AND file_type = ${fileType}
  `;

  return extractRows(result).length || 0;
}

function normalizeBlobPath(filePath?: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const trimmed = filePath.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("users/")) {
    return decodeURIComponent(trimmed);
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
    const decoded = decodeURIComponent(pathname);
    if (decoded.startsWith("users/")) {
      return decoded;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

function encodeBlobPath(blobPath: string): string {
  return blobPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function isBlobStillReferenced(sqlInstance: any, blobPath: string): Promise<boolean> {
  const encodedPath = encodeBlobPath(blobPath);
  const likeDecoded = `%${blobPath}`;
  const likeEncoded = `%${encodedPath}`;

  const referenceResult = await sqlInstance`
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

  return extractRows(referenceResult).length > 0;
}

async function deleteBlobIfExists(blobPath: string): Promise<void> {
  try {
    const lastSlashIndex = blobPath.lastIndexOf("/");
    const prefix = lastSlashIndex >= 0 ? blobPath.substring(0, lastSlashIndex + 1) : "";

    let cursor: string | undefined;
    do {
      const { blobs, cursor: nextCursor } = await list({ prefix, cursor });
      const targetBlob = blobs.find((blob) => blob.pathname === blobPath);

      if (targetBlob) {
        await del(targetBlob.url);
        console.log("FILE-DELETE: Deleted blob after source file removal:", blobPath);
        return;
      }

      cursor = nextCursor;
    } while (cursor);

    console.warn("FILE-DELETE: Blob not found for cleanup:", blobPath);
  } catch (error) {
    console.error("FILE-DELETE: Error deleting blob for source file:", blobPath, error);
  }
}

/**
 * Delete a user file with cascade deletion
 * Handles both database files and Vercel Blob files
 * For database files: removes from source_files table
 * For blob files: removes from Vercel Blob storage
 */
export async function deleteUserFile(fileId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  const sqlInstance = await getSqlInstance();

  try {
    // First, check if it's a database file (UUID format) or blob file (pathname)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId);

    if (isUuid) {
      // It's a database file - get file info before deleting
      const fileResult = await sqlInstance.query(
        `SELECT file_path, document_id FROM source_files WHERE id = $1`,
        [fileId],
      );
      const fileRows = extractRows(fileResult);

      if (fileRows.length === 0) {
        return { success: false, error: "File not found" };
      }

      const file = fileRows[0] as { file_path?: string; document_id?: string };

      // Verify the file belongs to the user
      const docResult = await sqlInstance.query(`SELECT user_id FROM documents WHERE id = $1`, [file.document_id]);
      const docRows = extractRows(docResult);

      if (docRows.length === 0 || docRows[0].user_id !== userId) {
        return { success: false, error: "Unauthorized: File does not belong to user" };
      }

      // Delete from database
      await sqlInstance.query(`DELETE FROM source_files WHERE id = $1`, [fileId]);

      // If the file has a blob path, also delete from Vercel Blob
      if (file.file_path && file.file_path.startsWith("users/") && process.env.BLOB_READ_WRITE_TOKEN) {
        try {
          await del(file.file_path);
        } catch (blobError) {
          console.error("Error deleting from Vercel Blob:", blobError);
          // Continue even if blob deletion fails - database record is already deleted
        }
      }

      return { success: true };
    } else {
      // It's a blob file (pathname) - delete from Vercel Blob
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return { success: false, error: "Blob storage not configured" };
      }

      // Verify the file belongs to the user by checking the path
      const userEmail = await getUserEmail(userId);
      if (!userEmail) {
        return { success: false, error: "User email not found" };
      }

      const expectedPrefix = `users/${userEmail}/`;
      if (!fileId.startsWith(expectedPrefix)) {
        console.error("File path mismatch:", { fileId, expectedPrefix });
        return { success: false, error: "Unauthorized: File does not belong to user" };
      }

      // Try to delete any database records that reference this blob path
      // Note: Files may exist only in blob storage (no DB record), which is fine
      // The database might store either:
      // 1. Just the pathname: "users/email/filename"
      // 2. Full blob URL: "https://xxx.public.blob.vercel-storage.com/users/email/filename"
      try {
        // Extract just the filename from the blob path for matching
        const blobFileName = fileId.split("/").pop();

        // Try multiple matching strategies to find database records:
        // 1. Exact pathname match
        // 2. URL containing pathname (for full blob URLs)
        // 3. Filename match (in case path structure differs)
        const deleteQuery = `
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
        `;
        const likePatternEnd = `%${fileId}`; // Match URLs ending with the pathname
        const likePatternAny = `%${blobFileName}%`; // Match any path containing the filename
        const deleteResult = await sqlInstance.query(deleteQuery, [fileId, likePatternEnd, likePatternAny, blobFileName, userId]);
        const deletedRows = extractRows(deleteResult);
        
        if (deletedRows.length > 0) {
          console.log(`Deleted ${deletedRows.length} database record(s) for blob path: ${fileId}`);
        }
        // If no records found, that's fine - file may only exist in blob storage
      } catch (dbError) {
        console.error("Error deleting database records for blob:", dbError);
        // Continue with blob deletion even if database deletion fails
      }

      // Delete from Vercel Blob
      try {
        console.log("Attempting to delete blob:", fileId);
        
        // First, find the blob to get its URL (del() works better with URL)
        const prefix = fileId.substring(0, fileId.lastIndexOf("/") + 1);
        const { blobs } = await list({ prefix });
        const targetBlob = blobs.find((blob) => blob.pathname === fileId);
        
        if (!targetBlob) {
          console.log("Blob file not found, may have already been deleted:", fileId);
          return { success: true }; // Consider it successful if it doesn't exist
        }
        
        console.log("Found blob:", { pathname: targetBlob.pathname, url: targetBlob.url });
        
        // Delete using the blob URL (more reliable than pathname)
        // According to Vercel docs, del() accepts URL or pathname, but URL is preferred
        await del(targetBlob.url);
        console.log("Delete call completed for blob URL:", targetBlob.url);
        
        // Note: Vercel Blob may take up to 1 minute to fully remove from cache
        // So we don't verify immediately - the deletion request was successful
        console.log("Successfully initiated deletion for blob:", fileId);
        return { success: true };
      } catch (error) {
        console.error("Error deleting from Vercel Blob:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("Full error details:", error);
        return { success: false, error: `Failed to delete from blob storage: ${errorMessage}` };
      }
    }
  } catch (error) {
    console.error("Error deleting user file:", error);
    return { success: false, error: "Failed to delete file" };
  }
}
