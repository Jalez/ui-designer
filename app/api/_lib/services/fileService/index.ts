// Re-export types from shared file

// Re-export all CRUD operations
export * from "./create";
export * from "./delete";
export * from "./read";
export type {
  CreateSourceFileOptions,
  DatabaseSourceFile,
  SourceFileType,
  UpdateSourceFileOptions,
} from "./types";
export * from "./update";

import { getSourceFiles } from "../documentService";
// Legacy SourceFileService namespace object for backward compatibility
import * as create from "./create";
import * as del from "./delete";
import * as read from "./read";
import * as update from "./update";

export const SourceFileService = {
  // Create operations
  createSourceFile: create.createSourceFile,

  // Read operations
  getSourceFiles: getSourceFiles,
  getSourceFileById: read.getSourceFileById,
  getSourceFilesForDocuments: read.getSourceFilesForDocuments,
  getSourceFilesByType: read.getSourceFilesByType,
  countSourceFiles: read.countSourceFiles,
  hasSourceFiles: read.hasSourceFiles,

  // Update operations
  updateSourceFile: update.updateSourceFile,
  updateSourceFiles: update.updateSourceFiles,
  updateSourceFileSections: update.updateSourceFileSections,
  updateSourceFileHighlightColor: update.updateSourceFileHighlightColor,

  // Delete operations
  deleteSourceFile: del.deleteSourceFile,
  deleteSourceFiles: del.deleteSourceFiles,
  deleteSourceFilesForDocument: del.deleteSourceFilesForDocument,
  cleanupDuplicateSourceFiles: del.cleanupDuplicateSourceFiles,
  deleteSourceFilesByType: del.deleteSourceFilesByType,
  deleteUserFile: del.deleteUserFile,

  // Storage management
  getAllUserFiles: read.getAllUserFiles,
};
