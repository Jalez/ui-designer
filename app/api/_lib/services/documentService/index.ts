// Re-export types from shared file

// Re-export all CRUD operations
export * from "./create";
export * from "./delete";
export * from "./read";
export * from "./temporary";
export type { DocumentChange, DocumentSession, DocumentShare, PermissionLevel } from "./types";
export * from "./update";

// Legacy DocumentService namespace object for backward compatibility
import * as create from "./create";
import * as del from "./delete";
import * as read from "./read";
import * as temporary from "./temporary";
import * as update from "./update";

export const DocumentService = {
  // Create operations
  createDocument: create.createDocument,
  addSourceFile: create.addSourceFile,
  shareDocument: create.shareDocument,
  createSession: create.createSession,
  addDocumentChange: create.addDocumentChange,

  // Read operations
  getDocuments: read.getDocuments,
  getDocument: read.getDocument,
  getDocumentById: read.getDocumentById,
  getSourceFiles: read.getSourceFiles,
  getDocumentShares: read.getDocumentShares,
  getDocumentAccessList: read.getDocumentAccessList,
  getUserSharedDocuments: read.getUserSharedDocuments,
  checkDocumentPermission: read.checkDocumentPermission,
  getDocumentWithPermission: read.getDocumentWithPermission,
  checkUserAccess: read.checkUserAccess,
  getGuestAccessSettings: read.getGuestAccessSettings,
  getActiveSessions: read.getActiveSessions,
  getDocumentChanges: read.getDocumentChanges,

  // Update operations
  updateDocument: update.updateDocument,
  updateDocumentShare: update.updateDocumentShare,
  updateSessionActivity: update.updateSessionActivity,
  setGuestAccess: update.setGuestAccess,

  // Delete operations
  deleteDocument: del.deleteDocument,
  deleteSourceFile: del.deleteSourceFile,
  removeDocumentShare: del.removeDocumentShare,
  removeSession: del.removeSession,

  // Temporary document operations
  extendTemporaryDocumentExpiration: temporary.extendTemporaryDocumentExpiration,
  isTemporaryDocumentValid: temporary.isTemporaryDocumentValid,
  claimTemporaryDocuments: temporary.claimTemporaryDocuments,
};
