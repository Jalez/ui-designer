/**
 * Vercel Blob storage implementation
 */

import { del, list } from "@vercel/blob";
import type { BlobInfo, IBlobStorageService } from "./types";

export class VercelBlobService implements IBlobStorageService {
  private readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;
  }

  /**
   * Check if blob storage is configured
   */
  isAvailable(): boolean {
    return this.isConfigured;
  }

  /**
   * Delete a blob by pathname
   */
  async delete(blobPath: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error("Blob storage not configured");
    }

    // First, find the blob to get its URL (del() works better with URL)
    const prefix = blobPath.substring(0, blobPath.lastIndexOf("/") + 1);
    let cursor: string | undefined;

    do {
      const { blobs, cursor: nextCursor } = await list({ prefix, cursor });
      const targetBlob = blobs.find((blob) => blob.pathname === blobPath);

      if (targetBlob) {
        await del(targetBlob.url);
        console.log("FILE-DELETE: Deleted blob:", blobPath);
        return;
      }

      cursor = nextCursor;
    } while (cursor);

    console.warn("FILE-DELETE: Blob not found for deletion:", blobPath);
  }

  /**
   * Check if a blob exists
   */
  async exists(blobPath: string): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    const prefix = blobPath.substring(0, blobPath.lastIndexOf("/") + 1);
    let cursor: string | undefined;

    do {
      const { blobs, cursor: nextCursor } = await list({ prefix, cursor });
      const exists = blobs.some((blob) => blob.pathname === blobPath);

      if (exists) {
        return true;
      }

      cursor = nextCursor;
    } while (cursor);

    return false;
  }

  /**
   * List blobs with a given prefix
   */
  async list(prefix: string): Promise<BlobInfo[]> {
    if (!this.isConfigured) {
      return [];
    }

    const allBlobs: BlobInfo[] = [];
    let cursor: string | undefined;

    do {
      const { blobs, cursor: nextCursor } = await list({ prefix, cursor });

      for (const blob of blobs) {
        allBlobs.push({
          pathname: blob.pathname,
          url: blob.url,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
        });
      }

      cursor = nextCursor;
    } while (cursor);

    return allBlobs;
  }

  /**
   * Find a blob by pathname and return its info
   */
  async findByPathname(blobPath: string): Promise<BlobInfo | null> {
    if (!this.isConfigured) {
      return null;
    }

    const prefix = blobPath.substring(0, blobPath.lastIndexOf("/") + 1);
    let cursor: string | undefined;

    do {
      const { blobs, cursor: nextCursor } = await list({ prefix, cursor });
      const targetBlob = blobs.find((blob) => blob.pathname === blobPath);

      if (targetBlob) {
        return {
          pathname: targetBlob.pathname,
          url: targetBlob.url,
          size: targetBlob.size,
          uploadedAt: targetBlob.uploadedAt,
        };
      }

      cursor = nextCursor;
    } while (cursor);

    return null;
  }
}




