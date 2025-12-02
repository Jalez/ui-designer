/**
 * Authorization service for file operations
 */

import { getSqlInstance } from "../../../db/shared";
import { getUserEmail } from "../../userService";
import * as queries from "./sourceFileQueries";
import type { IAuthorizationService } from "./types";

export class AuthorizationService implements IAuthorizationService {
  /**
   * Verify that a file (by UUID) belongs to a user
   */
  async verifyFileOwnership(fileId: string, userId: string): Promise<boolean> {
    const sqlInstance = await getSqlInstance();

    const file = await queries.getSourceFileByIdParam(sqlInstance, fileId);
    if (!file || !file.document_id) {
      return false;
    }

    const docUserId = await queries.getDocumentUserId(sqlInstance, file.document_id);
    return docUserId === userId;
  }

  /**
   * Verify that a blob path belongs to a user
   */
  async verifyBlobPathOwnership(blobPath: string, userId: string): Promise<boolean> {
    const userEmail = await getUserEmail(userId);
    if (!userEmail) {
      return false;
    }

    const expectedPrefix = `users/${userEmail}/`;
    return blobPath.startsWith(expectedPrefix);
  }
}

let defaultAuthorizationService: IAuthorizationService | null = null;

/**
 * Get the default authorization service instance
 */
export function getAuthorizationService(): IAuthorizationService {
  if (!defaultAuthorizationService) {
    defaultAuthorizationService = new AuthorizationService();
  }
  return defaultAuthorizationService;
}

/**
 * Create an authorization service instance
 * Useful for dependency injection in tests
 */
export function createAuthorizationService(): IAuthorizationService {
  return new AuthorizationService();
}




