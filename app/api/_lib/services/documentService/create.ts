import type { Document, LocalSourceFile, SourceFile } from "@/components/scriba/document";
import type { DriveSourceFile } from "@/components/scriba/document/types";
import { getSqlInstance } from "../../db/shared";
import type { DocumentChange, DocumentSession, DocumentShare, PermissionLevel } from "./types";

export interface CreateDocumentOptions {
  title?: string;
  isTemporary?: boolean;
  anonymousSessionId?: string;
  expirationHours?: number;
}

type CreateDocumentParams = {
  userId: string;
  titleOrOptions?: string | CreateDocumentOptions;
};
// Create a new document
export async function createDocument({ userId, titleOrOptions }: CreateDocumentParams): Promise<Document> {
  const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const sqlInstance = await getSqlInstance();

  // Parse options
  let options: CreateDocumentOptions;
  if (typeof titleOrOptions === "string") {
    options = { title: titleOrOptions };
  } else {
    options = titleOrOptions || {};
  }

  const { title = "New Document", isTemporary = false, anonymousSessionId = null, expirationHours = 1 } = options;

  // Authenticated users (with email userId) cannot create temporary documents
  const isAuthenticatedUser = userId?.includes("@");
  if (isAuthenticatedUser && isTemporary) {
    throw new Error("Authenticated users cannot create temporary documents");
  }

  // Calculate expiration time for temporary documents
  const expiresAt = isTemporary ? new Date(now.getTime() + expirationHours * 60 * 60 * 1000) : null;

  console.log(`📝 Creating document: ${title}`, {
    userId,
    userIdType: typeof userId,
    isTemporary,
    anonymousSessionId,
    expiresAt: expiresAt?.toISOString(),
  });

  // Try to insert with all columns
  try {
    await sqlInstance`
      INSERT INTO documents (
        id, user_id, title, content, content_html, content_json,
        has_been_entered, is_temporary, anonymous_session_id, expires_at,
        created_at, updated_at
      )
      VALUES (
        ${id}, ${userId}, ${title}, '', '', NULL,
        false, ${isTemporary}, ${anonymousSessionId}, ${expiresAt},
        ${now}, ${now}
      )
    `;
    
    console.log(`✅ Document created with user_id: ${userId} (document id: ${id})`);
  } catch (error) {
    // Fall back for older schema without temporary document columns
    console.warn(
      "⚠️ DocumentService: Temporary document columns not available, creating basic document:",
      error.message,
    );
    try {
      await sqlInstance`
        INSERT INTO documents (id, user_id, title, content, content_html, content_json, has_been_entered, created_at, updated_at)
        VALUES (${id}, ${userId}, ${title}, '', '', NULL, false, ${now}, ${now})
      `;
    } catch (_fallbackError) {
      // Final fallback without content_json
      await sqlInstance`
        INSERT INTO documents (id, user_id, title, content, content_html, has_been_entered, created_at, updated_at)
        VALUES (${id}, ${userId}, ${title}, '', '', false, ${now}, ${now})
      `;
    }
  }

  // Add the creator as owner in document_shares table
  const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await sqlInstance`
    INSERT INTO document_shares (id, document_id, owner_user_id, shared_user_id, permission, created_at, updated_at)
    VALUES (${shareId}, ${id}, ${userId}, ${userId}, 'owner', ${now}, ${now})
  `;

  return {
    id,
    title,
    content: "",
    pageIds: [],
    sourceFileIds: [],
    hasBeenEntered: false,
    createdAt: now,
    updatedAt: now,
  };
}

// Add a source file
export async function addSourceFile(
  file: Omit<LocalSourceFile, "id" | "timestamp"> | Omit<DriveSourceFile, "id" | "timestamp">,
): Promise<SourceFile> {
  const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const sqlInstance = await getSqlInstance();

  if (file.type === "drive") {
    await sqlInstance`
        INSERT INTO source_files (
          id, document_id, file_type, file_name, file_size, mime_type,
          drive_file_id, web_view_link, web_content_link, timestamp
        ) VALUES (${id}, ${file.documentId}, ${file.fileType}, ${file.fileName}, ${file.fileSize}, ${file.mimeType},
          ${file.driveFileId}, ${file.webViewLink}, ${file.webContentLink}, ${now})
      `;
  } else {
    await sqlInstance`
        INSERT INTO source_files (
          id, document_id, file_type, file_name, file_size, mime_type,
          file_path, timestamp
        ) VALUES (${id}, ${file.documentId}, ${file.fileType}, ${file.fileName}, ${file.fileSize}, ${file.mimeType},
          ${file.filePath}, ${now})
      `;
  }

  return {
    ...file,
    id,
    createdAt: now,
  } as SourceFile;
}

type ShareDocumentParams = {
  documentId: string;
  ownerUserId: string;
  sharedUserId: string;
  permission: PermissionLevel;
};

// Document Sharing Methods - Create
export async function shareDocument({
  documentId,
  ownerUserId,
  sharedUserId,
  permission,
}: ShareDocumentParams): Promise<DocumentShare> {
  const id = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const sqlInstance = await getSqlInstance();

  await sqlInstance`
      INSERT INTO document_shares (id, document_id, owner_user_id, shared_user_id, permission, created_at, updated_at)
      VALUES (${id}, ${documentId}, ${ownerUserId}, ${sharedUserId}, ${permission}, ${now}, ${now})
      ON CONFLICT (document_id, shared_user_id)
      DO UPDATE SET permission = ${permission}, updated_at = ${now}
    `;

  return {
    id,
    documentId,
    ownerUserId,
    sharedUserId,
    permission,
    allowGuestAccess: false, // Default to false for user shares
    createdAt: now,
    updatedAt: now,
  };
}

type CreateSessionParams = {
  documentId: string;
  userId: string;
  userName?: string;
};

// Real-time Collaboration Methods - Create
export async function createSession({ documentId, userId, userName }: CreateSessionParams): Promise<DocumentSession> {
  const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const sqlInstance = await getSqlInstance();

  await sqlInstance`
      INSERT INTO document_sessions (id, document_id, user_id, user_name, last_active_at, created_at, updated_at)
      VALUES (${id}, ${documentId}, ${userId}, ${userName}, ${now}, ${now}, ${now})
    `;

  return {
    id,
    documentId,
    userId,
    userName,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export async function addDocumentChange(
  documentId: string,
  sessionId: string,
  userId: string,
  version: number,
  operation: any,
): Promise<DocumentChange> {
  const id = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const sqlInstance = await getSqlInstance();

  await sqlInstance`
      INSERT INTO document_changes (id, document_id, session_id, user_id, version, operation, created_at)
      VALUES (${id}, ${documentId}, ${sessionId}, ${userId}, ${version}, ${JSON.stringify(operation)}, ${now})
    `;

  return {
    id,
    documentId,
    sessionId,
    userId,
    version,
    operation,
    createdAt: now,
  };
}
