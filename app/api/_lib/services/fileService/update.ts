import type { SourceFile } from "@/components/scriba/document";
import { extractRows, getSqlInstance } from "../../db/shared";
import { mapDatabaseToSourceFile } from "./shared";
import type { DatabaseSourceFile, UpdateSourceFileOptions } from "./types";

// Update a source file
export async function updateSourceFile(id: string, updates: UpdateSourceFileOptions): Promise<SourceFile> {
  // Build dynamic update query
  const updateFields = [];
  const updateValues = [];
  const allowedFields = ["fileName", "fileSize", "mimeType", "filePath", "sections", "highlightColor"];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      const dbField =
        key === "fileName"
          ? "file_name"
          : key === "fileSize"
            ? "file_size"
            : key === "mimeType"
              ? "mime_type"
              : key === "filePath"
                ? "file_path"
                : key === "sections"
                  ? "sections"
                  : key === "highlightColor"
                    ? "highlight_color"
                    : key;

      updateFields.push(`${dbField} = $${updateValues.length + 2}`); // Start from $2 since $1 is for id
      updateValues.push(value);
    }
  }

  if (updateFields.length === 0) {
    throw new Error("No fields to update");
  }

  const sqlInstance = await getSqlInstance();

  const updateQuery = `
    UPDATE source_files SET
      ${updateFields.join(", ")},
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;

  const result = await sqlInstance.query(updateQuery, [id, ...updateValues]);

  const rows = extractRows(result);
  if (rows.length === 0) {
    throw new Error("Source file not found");
  }

  return mapDatabaseToSourceFile(rows[0] as DatabaseSourceFile);
}

// Update multiple source files (batch operation)
export async function updateSourceFiles(ids: string[], updates: UpdateSourceFileOptions): Promise<SourceFile[]> {
  const updatedFiles: SourceFile[] = [];

  // Update each file individually to maintain transaction safety
  for (const id of ids) {
    try {
      const updatedFile = await updateSourceFile(id, updates);
      updatedFiles.push(updatedFile);
    } catch (error) {
      console.error(`Failed to update source file ${id}:`, error);
      // Continue with other files but log the error
    }
  }

  return updatedFiles;
}

// Update sections for a source file (specific use case)
export async function updateSourceFileSections(id: string, sections: string[]): Promise<SourceFile> {
  return updateSourceFile(id, { sections });
}

// Update highlight color for a source file
export async function updateSourceFileHighlightColor(id: string, highlightColor: string): Promise<SourceFile> {
  return updateSourceFile(id, { highlightColor });
}
