/**
 * Types and interfaces for database service
 */

export interface SourceFileMetadata {
  id: string;
  file_path: string | null;
  document_id: string;
  user_id: string;
}

export interface ISourceFileRepository {
  getById(id: string): Promise<SourceFileMetadata | null>;
  delete(id: string): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<number>;
  deleteByType(documentId: string, fileType: string): Promise<number>;
  cleanupDuplicates(documentId: string): Promise<number>;
  isBlobReferenced(blobPath: string): Promise<boolean>;
  deleteByBlobPath(blobPath: string, userId: string): Promise<number>;
}

export interface IAuthorizationService {
  verifyFileOwnership(fileId: string, userId: string): Promise<boolean>;
  verifyBlobPathOwnership(blobPath: string, userId: string): Promise<boolean>;
}





