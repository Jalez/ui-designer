/**
 * Types and interfaces for blob storage service
 */

export interface BlobInfo {
  pathname: string;
  url: string;
  size?: number;
  uploadedAt?: Date;
}

export interface IBlobStorageService {
  delete(blobPath: string): Promise<void>;
  exists(blobPath: string): Promise<boolean>;
  list(prefix: string): Promise<BlobInfo[]>;
}




