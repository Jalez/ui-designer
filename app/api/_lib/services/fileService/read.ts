import { list, type ListBlobResultBlob } from "@vercel/blob";
import type { SourceFile } from "@/components/scriba/document";
import { extractRows, getSqlInstance } from "../../db/shared";
import { getSourceFiles } from "../documentService";
import { getUserEmail } from "../userService";
import { mapDatabaseToSourceFile } from "./shared";
import type { DatabaseSourceFile } from "./types";

// Get source files for multiple documents (useful for batch operations)
export async function getSourceFilesForDocuments(documentIds: string[]): Promise<Record<string, SourceFile[]>> {
  if (documentIds.length === 0) return {};

  const sqlInstance = await getSqlInstance();
  const placeholders = documentIds.map((_, i) => `$${i + 1}`).join(",");
  const result = await sqlInstance.query(
    `
    SELECT * FROM source_files
    WHERE document_id IN (${placeholders})
    ORDER BY document_id, created_at
  `,
    documentIds,
  );

  const rows = extractRows(result);

  // Group by document_id
  const grouped: Record<string, SourceFile[]> = {};
  rows.forEach((row: any) => {
    const documentId = row.document_id;
    if (!grouped[documentId]) {
      grouped[documentId] = [];
    }
    grouped[documentId].push(mapDatabaseToSourceFile(row as DatabaseSourceFile));
  });

  return grouped;
}

// Get source files by type
export async function getSourceFilesByType(documentId: string, fileType: string): Promise<SourceFile[]> {
  const allFiles = await getSourceFiles(documentId);
  return allFiles.filter((file) => file.fileType === fileType);
}

// Count source files for a document
export async function countSourceFiles(documentId: string): Promise<number> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
    SELECT COUNT(*) as count FROM source_files WHERE document_id = ${documentId}
  `;

  const rows = extractRows(result);
  return parseInt(String((rows[0] as any).count), 10) || 0;
}

// Check if document has any source files
export async function hasSourceFiles(documentId: string): Promise<boolean> {
  const count = await countSourceFiles(documentId);
  return count > 0;
}

// Get a single source file by ID
export async function getSourceFileById(id: string): Promise<SourceFile | null> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
    SELECT * FROM source_files WHERE id = ${id}
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    return null;
  }

  return mapDatabaseToSourceFile(rows[0] as DatabaseSourceFile);
}

/**
 * Get Vercel Blob storage usage for a user
 */
async function getBlobStorageUsage(userEmail: string): Promise<number> {
  // Check if Vercel Blob is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return 0;
  }

  try {
    const prefix = `users/${userEmail}/`;
    const { blobs } = await list({ prefix });

    // Sum up the sizes of all blobs for this user
    const totalBytes = blobs.reduce((sum, blob) => {
      return sum + (blob.size || 0);
    }, 0);

    return totalBytes;
  } catch (error) {
    console.error("Error calculating Vercel Blob storage usage for user:", userEmail, error);
    return 0;
  }
}

type BlobWithOptionalMime = ListBlobResultBlob & {
  contentType?: string | null;
  metadata?: {
    mimeType?: string | null;
  };
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  avi: "video/x-msvideo",
  bmp: "image/bmp",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "application/json",
  md: "text/markdown",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  svg: "image/svg+xml",
  txt: "text/plain",
  wav: "audio/wav",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function inferMimeTypeFromFilename(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? null;
  if (!extension) {
    return null;
  }
  return EXTENSION_MIME_MAP[extension] ?? null;
}

function resolveBlobMimeType(blob: ListBlobResultBlob, fileName: string): string | null {
  const blobWithOptionalMime = blob as BlobWithOptionalMime;

  const inlineMime = typeof blobWithOptionalMime.contentType === "string" ? blobWithOptionalMime.contentType.trim() : "";
  if (inlineMime) {
    return inlineMime;
  }

  const metadataMime =
    typeof blobWithOptionalMime.metadata?.mimeType === "string" ? blobWithOptionalMime.metadata.mimeType.trim() : "";
  if (metadataMime) {
    return metadataMime;
  }

  return inferMimeTypeFromFilename(fileName);
}

/**
 * Get all files for a user from both database and Vercel Blob
 * Returns unified list with metadata
 */
export interface UserFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string | null;
  uploadDate: Date;
  documentId: string | null;
  documentTitle: string | null;
  storageLocation: "database" | "blob";
  filePath?: string;
  url?: string;
}

export async function getAllUserFiles(userId: string): Promise<UserFile[]> {
  const sqlInstance = await getSqlInstance();
  const files: UserFile[] = [];

  try {
    // Get files from database (source_files)
    const dbQuery = `
      SELECT 
        sf.id,
        sf.file_name,
        sf.file_size,
        sf.mime_type,
        sf.created_at,
        sf.document_id,
        sf.file_path,
        d.title as document_title
      FROM source_files sf
      INNER JOIN documents d ON sf.document_id = d.id
      WHERE d.user_id = $1
      ORDER BY sf.created_at DESC
    `;
    const dbResult = await sqlInstance.query(dbQuery, [userId]);
    const dbRows = extractRows(dbResult);

    // Add database files to the list
    for (const row of dbRows as any[]) {
      files.push({
        id: row.id,
        fileName: row.file_name,
        fileSize: row.file_size || 0,
        mimeType: row.mime_type,
        uploadDate: new Date(row.created_at),
        documentId: row.document_id,
        documentTitle: row.document_title,
        storageLocation: "database",
        filePath: row.file_path,
      });
    }

    // Get files from Vercel Blob
    const userEmail = await getUserEmail(userId);
    if (userEmail && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const prefix = `users/${userEmail}/`;
        const { blobs } = await list({ prefix });

        // Add blob files to the list
        for (const blob of blobs) {
          // Check if this blob is already in the database (by pathname)
          const existingFile = files.find((f) => f.filePath === blob.pathname);
          if (!existingFile) {
            // Extract filename from pathname
            const fileName = blob.pathname.split("/").pop() || blob.pathname;
            files.push({
              id: blob.pathname, // Use pathname as ID for blob files
              fileName,
              fileSize: blob.size || 0,
              mimeType: resolveBlobMimeType(blob, fileName),
              uploadDate: new Date(blob.uploadedAt),
              documentId: null,
              documentTitle: null,
              storageLocation: "blob",
              filePath: blob.pathname,
              url: blob.url,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching Vercel Blob files:", error);
        // Continue without blob files if there's an error
      }
    }

    // Sort by upload date (newest first)
    files.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());

    return files;
  } catch (error) {
    console.error("Error fetching user files:", error);
    return [];
  }
}

/**
 * Get total storage usage for a user (for statistics)
 * Calculates from both database (source_files) and Vercel Blob storage
 * Avoids double-counting files that exist in both places
 */
export async function getStorageUsage(userId: string): Promise<number> {
  const sqlInstance = await getSqlInstance();

  try {
    // Get all database files with their file_path to identify which ones are in blob storage
    const dbFilesQuery = `
      SELECT sf.file_size, sf.file_path
      FROM source_files sf
      INNER JOIN documents d ON sf.document_id = d.id
      WHERE d.user_id = $1
        AND sf.file_size IS NOT NULL
    `;
    const dbFilesResult = await sqlInstance.query(dbFilesQuery, [userId]);
    const dbFiles = extractRows(dbFilesResult) as Array<{ file_size: number | string; file_path: string | null }>;

    // Sum all database file sizes (these are the source of truth for files in the database)
    let databaseStorageBytes = 0;
    const dbBlobPaths = new Set<string>(); // Track which blob paths are already counted in DB

    for (const file of dbFiles) {
      const fileSize = Number(file.file_size) || 0;
      databaseStorageBytes += fileSize;

      // If file_path points to a blob, track it so we don't count it again from blob storage
      if (file.file_path) {
        // Check if it's a blob path (starts with "users/" or contains blob URL)
        if (file.file_path.startsWith("users/")) {
          dbBlobPaths.add(file.file_path);
        } else if (file.file_path.includes("blob.vercel-storage.com")) {
          // Extract pathname from full blob URL
          try {
            const url = new URL(file.file_path);
            const pathname = url.pathname.substring(1); // Remove leading slash
            if (pathname.startsWith("users/")) {
              dbBlobPaths.add(pathname);
            }
          } catch {
            // If URL parsing fails, try to extract pathname manually
            const match = file.file_path.match(/users\/[^/]+\/[^/]+/);
            if (match) {
              dbBlobPaths.add(match[0]);
            }
          }
        }
      }
    }

    // Get user email for Vercel Blob query
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      // If we can't get email, return database storage only
      return databaseStorageBytes;
    }

    // Get Vercel Blob storage usage, excluding files already counted in database
    let blobStorageBytes = 0;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const prefix = `users/${userEmail}/`;
        const { blobs } = await list({ prefix });

        // Only count blob files that don't have a corresponding database record
        for (const blob of blobs) {
          // Check if this blob is already counted in the database
          const isInDatabase = dbBlobPaths.has(blob.pathname) || 
                               Array.from(dbBlobPaths).some(dbPath => 
                                 blob.pathname.includes(dbPath) || 
                                 dbPath.includes(blob.pathname)
                               );

          if (!isInDatabase) {
            blobStorageBytes += blob.size || 0;
          }
        }
      } catch (error) {
        console.error("Error calculating Vercel Blob storage usage for user:", userEmail, error);
        // Continue with database storage only if blob query fails
      }
    }

    // Return combined storage usage (database files + blob-only files)
    return databaseStorageBytes + blobStorageBytes;
  } catch (error) {
    console.error("Error calculating storage usage for user:", userId, error);
    return 0;
  }
}
