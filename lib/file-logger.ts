/**
 * Simple utility to add file information to logs
 * Can be imported and used in individual files
 */

import { readFileSync } from "fs";
import { dirname, relative } from "path";
import { fileURLToPath } from "url";

/**
 * Get the current file path (ES modules compatible)
 */
export function getCurrentFilePath(importMetaUrl: string): string {
  try {
    const __filename = fileURLToPath(importMetaUrl);
    return relative(process.cwd(), __filename);
  } catch {
    return "unknown";
  }
}

/**
 * Get the current file name from import.meta.url
 */
export function getCurrentFileName(importMetaUrl: string): string {
  try {
    const path = getCurrentFilePath(importMetaUrl);
    return path.split("/").pop() || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Create a logger function for a specific file
 */
export function createFileLogger(filePath: string) {
  const fileInfo = `[${filePath}]`;

  return {
    log: (message: string, ...args: any[]) => {
      console.log(`${fileInfo} ${message}`, ...args);
    },
    info: (message: string, ...args: any[]) => {
      console.info(`${fileInfo} ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`${fileInfo} ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      console.error(`${fileInfo} ${message}`, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      console.debug(`${fileInfo} ${message}`, ...args);
    },
  };
}

/**
 * Usage example:
 *
 * // At the top of your file
 * import { createFileLogger, getCurrentFilePath } from '@/lib/file-logger';
 * const logger = createFileLogger(getCurrentFilePath(import.meta.url));
 *
 * // Then use instead of console.log
 * logger.log("SERVER: WEBHOOK-RECEIVED: Processing event");
 *
 * // Or manually
 * console.log(`[${getCurrentFilePath(import.meta.url)}] SERVER: WEBHOOK-RECEIVED: Processing event`);
 */
