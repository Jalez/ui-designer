/**
 * Main blob storage service
 * Provides a default implementation using Vercel Blob
 */

import type { IBlobStorageService } from "./types";
import { VercelBlobService } from "./vercelBlobService";

let defaultService: IBlobStorageService | null = null;

/**
 * Get the default blob storage service instance
 */
export function getBlobStorageService(): IBlobStorageService {
  if (!defaultService) {
    defaultService = new VercelBlobService();
  }
  return defaultService;
}

/**
 * Create a blob storage service instance
 * Useful for dependency injection in tests
 */
export function createBlobStorageService(): IBlobStorageService {
  return new VercelBlobService();
}




