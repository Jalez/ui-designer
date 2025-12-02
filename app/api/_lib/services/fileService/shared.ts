// SourceFile service types and shared utilities

import type { DriveSourceFile, LocalSourceFile, SourceFile } from "@/components/scriba/document";
import { extractRows, getSqlInstance } from "../../db/shared";
import type { DatabaseResult } from "../../db";
import type { CreateSourceFileOptions, DatabaseSourceFile, SourceFileType } from "./types";

export async function getSourceFile(id: string): Promise<SourceFile | null> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
    SELECT * FROM source_files WHERE id = ${id}
  `;

  const rows = extractRows(result);
  if (rows.length === 0) return null;

  return mapDatabaseToSourceFile(rows[0] as DatabaseSourceFile);
}

export function mapDatabaseToSourceFile(row: DatabaseSourceFile): SourceFile {
  const baseFile = {
    id: row.id,
    fileType: row.file_type as SourceFileType,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: new Date(row.created_at),
    documentId: row.document_id,
  };

  if (row.drive_file_id) {
    return {
      ...baseFile,
      type: "drive" as const,
      driveFileId: row.drive_file_id,
      webViewLink: row.web_view_link,
      webContentLink: row.web_content_link,
    } as DriveSourceFile;
  } else {
    return {
      ...baseFile,
      type: "local" as const,
      filePath: row.file_path,
    } as LocalSourceFile;
  }
}

// Utility to generate content hash for data URLs (same as in frontend)
export function generateContentHash(base64Data: string): string {
  let hashValue = 0;
  for (let i = 0; i < base64Data.length; i++) {
    const char = base64Data.charCodeAt(i);
    hashValue = (hashValue << 5) - hashValue + char;
    hashValue = hashValue & hashValue; // Convert to 32bit integer
  }
  return Math.abs(hashValue).toString(36);
}

// Check for duplicate files
export async function findDuplicateSourceFile(
  documentId: string,
  options: CreateSourceFileOptions,
): Promise<string | null> {
  const sqlInstance = await getSqlInstance();

  if (options.filePath?.startsWith("data:")) {
    // Handle data URLs by checking content hash
    const dataUrlMatch = options.filePath.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUrlMatch) {
      const base64Data = dataUrlMatch[2];
      const contentHash = generateContentHash(base64Data);

      const existingFiles = await sqlInstance`
        SELECT id FROM source_files
        WHERE document_id = ${documentId}
        AND file_type = ${options.fileType}
        AND (file_name LIKE ${`%${contentHash}%`} OR file_path = ${options.filePath})
      `;

      const rows = extractRows(existingFiles);
      return rows.length > 0 ? (rows[0] as any).id : null;
    }
  }

  // Handle regular files and drive files
  let existingFiles: DatabaseResult;
  if (options.filePath) {
    existingFiles = await sqlInstance`
      SELECT id FROM source_files
      WHERE document_id = ${documentId}
      AND file_type = ${options.fileType}
      AND file_name = ${options.fileName}
      AND file_path = ${options.filePath}
    `;
  } else if (options.driveFileId) {
    existingFiles = await sqlInstance`
      SELECT id FROM source_files
      WHERE document_id = ${documentId}
      AND file_type = ${options.fileType}
      AND file_name = ${options.fileName}
      AND drive_file_id = ${options.driveFileId}
    `;
  } else {
    existingFiles = await sqlInstance`
      SELECT id FROM source_files
      WHERE document_id = ${documentId}
      AND file_type = ${options.fileType}
      AND file_name = ${options.fileName}
    `;
  }

  const rows = extractRows(existingFiles);
  return rows.length > 0 ? (rows[0] as any).id : null;
}
