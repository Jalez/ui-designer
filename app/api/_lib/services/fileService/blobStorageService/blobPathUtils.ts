/**
 * Pure utility functions for blob path normalization and encoding
 */

/**
 * Normalizes a file path to a blob path format
 * Handles both direct paths and full blob URLs
 */
export function normalizeBlobPath(filePath?: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const trimmed = filePath.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("users/")) {
    return decodeURIComponent(trimmed);
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
    const decoded = decodeURIComponent(pathname);
    if (decoded.startsWith("users/")) {
      return decoded;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}

/**
 * Encodes a blob path by encoding each segment
 */
export function encodeBlobPath(blobPath: string): string {
  return blobPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}




