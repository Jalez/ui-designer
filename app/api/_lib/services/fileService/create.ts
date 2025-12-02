import type { SourceFile } from "@/components/scriba/document";
import { extractRows, getSqlInstance } from "../../db/shared";
import { findDuplicateSourceFile, mapDatabaseToSourceFile } from "./shared";
import type { CreateSourceFileOptions } from "./types";

// Create a new source file
export async function createSourceFile(options: CreateSourceFileOptions): Promise<SourceFile> {
  // Check for duplicates first
  const existingId = await findDuplicateSourceFile(options.documentId, options);
  if (existingId) {
    throw new Error("Source file already exists");
  }

  const sqlInstance = await getSqlInstance();

  // Generate unique ID
  const id = `source-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const result = await sqlInstance`
    INSERT INTO source_files (
      id,
      document_id,
      file_type,
      file_name,
      file_size,
      mime_type,
      file_path,
      drive_file_id,
      sections,
      highlight_color,
      web_view_link,
      web_content_link
    ) VALUES (
      ${id},
      ${options.documentId},
      ${options.fileType},
      ${options.fileName},
      ${options.fileSize || null},
      ${options.mimeType || null},
      ${options.filePath || null},
      ${options.driveFileId || null},
      ${options.sections || null},
      ${options.highlightColor || null},
      ${options.webViewLink || null},
      ${options.webContentLink || null}
    )
    RETURNING *
  `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    throw new Error("Failed to create source file");
  }

  return mapDatabaseToSourceFile(rows[0] as any);
}
