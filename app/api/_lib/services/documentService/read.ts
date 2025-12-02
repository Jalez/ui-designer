import type { Document, DriveSourceFile, LocalSourceFile, SourceFile } from "@/components/scriba/document";
import { extractRows, getSqlInstance } from "../../db/shared";
import type { DocumentChange, DocumentSession, DocumentShare, PermissionLevel } from "./types";

// Get all documents for a user
export async function getDocuments(userId: string): Promise<Document[]> {
  try {
    const sqlInstance = await getSqlInstance();
    const result = await sqlInstance`
        SELECT * FROM documents WHERE user_id = ${userId} ORDER BY updated_at DESC
      `;

    const rows = extractRows(result);
    return rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content || "",
      contentHtml: row.content_html,
      contentJson: row.content_json
        ? typeof row.content_json === "string"
          ? row.content_json
          : JSON.stringify(row.content_json)
        : undefined, // Use JSON content when available
      pageIds: [], // Will be populated separately if needed
      sourceFileIds: [], // Will be populated separately if needed
      hasBeenEntered: row.has_been_entered,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      // Temporary document fields
      isTemporary: row.is_temporary || false,
      anonymousSessionId: row.anonymous_session_id || undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      claimedAt: row.claimed_at ? new Date(row.claimed_at) : undefined,
    }));
  } catch (error) {
    console.error(
      "DB: CONNECTION-FAIL: Error fetching documents. This often indicates the PostgreSQL Docker container is not running. Please check that your database container is started:",
      error,
    );
    return [];
  }
}

// Get a single document by ID with permission checking
export async function getDocument(documentId: string, userId: string): Promise<Document | null> {
  const sqlInstance = await getSqlInstance();

  // First try to get document owned by user
  let result = await sqlInstance`
      SELECT * FROM documents WHERE id = ${documentId} AND user_id = ${userId}
    `;

  let rows = extractRows(result);

  // If not found and user is not the owner, check for shared access
  if (rows.length === 0) {
    result = await sqlInstance`
        SELECT d.*, ds.permission
        FROM documents d
        JOIN document_shares ds ON d.id = ds.document_id
        WHERE d.id = ${documentId} AND ds.shared_user_id = ${userId}
      `;

    // Handle both array result (Neon) and Result object (pg)
    if (Array.isArray(result)) {
      rows = result;
    } else if (result && typeof result === "object" && "rows" in result) {
      rows = (result as any).rows;
    }
  }

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0] as any;
  return {
    id: row.id,
    title: row.title,
    content: row.content || "",
    contentHtml: row.content_html,
    contentJson: row.content_json
      ? typeof row.content_json === "string"
        ? row.content_json
        : JSON.stringify(row.content_json)
      : undefined, // Use JSON content when available
    pageIds: [], // Will be populated separately if needed
    sourceFileIds: [], // Will be populated separately if needed
    hasBeenEntered: row.has_been_entered,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    // Temporary document fields
    isTemporary: row.is_temporary || false,
    anonymousSessionId: row.anonymous_session_id || undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : undefined,
  };
}

// Get document by ID without user validation (for guest access)
export async function getDocumentById(documentId: string): Promise<Document | null> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
      SELECT * FROM documents WHERE id = ${documentId}
    `;

  const rows = extractRows(result);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0] as any;

  return {
    id: row.id,
    title: row.title,
    content: row.content || "",
    contentHtml: row.content_html,
    contentJson: row.content_json
      ? typeof row.content_json === "string"
        ? row.content_json
        : JSON.stringify(row.content_json)
      : undefined, // Use JSON content when available
    pageIds: [],
    sourceFileIds: [],
    hasBeenEntered: row.has_been_entered,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    // Temporary document fields
    isTemporary: row.is_temporary || false,
    anonymousSessionId: row.anonymous_session_id || undefined,
    expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    claimedAt: row.claimed_at ? new Date(row.claimed_at) : undefined,
  };
}

type CheckDocumentPermissionParams = {
  documentId: string;
  userId: string;
  requiredPermission: PermissionLevel;
};

// Check if user has specific permission for a document
export async function checkDocumentPermission({
  documentId,
  userId,
  requiredPermission,
}: CheckDocumentPermissionParams): Promise<{ hasAccess: boolean; permission?: PermissionLevel; isOwner?: boolean }> {
  const sqlInstance = await getSqlInstance();

  try {
    // Check if user is admin - admins have access to all documents
    const adminResult = await sqlInstance`
        SELECT ar.id FROM admin_roles ar WHERE ar.user_id = ${userId} AND ar.is_active = true LIMIT 1
      `;

    const adminRows = Array.isArray(adminResult)
      ? adminResult
      : adminResult && typeof adminResult === "object" && "rows" in adminResult
        ? (adminResult as any).rows
        : [];

    if (adminRows.length > 0) {
      return { hasAccess: true, permission: "owner", isOwner: false }; // Admin has owner permission but not document owner
    }

    // Check if user is the owner
    const ownerResult = await sqlInstance`
        SELECT id FROM documents WHERE id = ${documentId} AND user_id = ${userId}
      `;

    // Handle both array result (Neon) and Result object (pg)
    let ownerRows = [];
    if (Array.isArray(ownerResult)) {
      ownerRows = ownerResult;
    } else if (ownerResult && typeof ownerResult === "object" && "rows" in ownerResult) {
      ownerRows = (ownerResult as any).rows;
    }

    if (ownerRows.length > 0) {
      return { hasAccess: true, permission: "owner", isOwner: true };
    }

    try {
      // Check shared permissions
      const shareResult = await sqlInstance`
        SELECT permission FROM document_shares
        WHERE document_id = ${documentId} AND shared_user_id = ${userId}
      `;

      // Handle both array result (Neon) and Result object (pg)
      let shareRows = [];
      if (Array.isArray(shareResult)) {
        shareRows = shareResult;
      } else if (shareResult && typeof shareResult === "object" && "rows" in shareResult) {
        shareRows = (shareResult as any).rows;
      }

      if (shareRows.length > 0) {
        const userPermission = (shareRows[0] as any).permission as PermissionLevel;

        // Check if user's permission level meets the requirement
        const permissionHierarchy = { owner: 3, editor: 2, viewer: 1 };
        const requiredLevel = permissionHierarchy[requiredPermission];
        const userLevel = permissionHierarchy[userPermission];

        const hasAccess = userLevel >= requiredLevel;

        return { hasAccess, permission: userPermission, isOwner: false };
      }

      return { hasAccess: false };
    } catch (error) {
      console.error("❌ DocumentService: Error in checkDocumentPermission:", error);
      console.error("❌ DocumentService: Error details:", {
        documentId,
        userId,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      throw error; // Re-throw the error so it bubbles up
    }
  } catch (error) {
    console.error("❌ DocumentService: Error in checkDocumentPermission (outer):", error);
    return { hasAccess: false };
  }
}

type GetDocumentWithPermissionParams = {
  documentId: string;
  userId: string;
};

// Get document with permission info
export async function getDocumentWithPermission({ documentId, userId }: GetDocumentWithPermissionParams): Promise<{
  document: Document;
  permission: PermissionLevel;
  isOwner: boolean;
} | null> {
  const document = await getDocument(documentId, userId);
  if (!document) {
    return null;
  }

  const permissionInfo = await checkDocumentPermission({ documentId, userId, requiredPermission: "viewer" });

  if (!permissionInfo.hasAccess) {
    return null;
  }

  return {
    document,
    permission: permissionInfo.permission || "viewer",
    isOwner: permissionInfo.isOwner || false,
  };
}

// Get source files for a document
export async function getSourceFiles(documentId: string): Promise<SourceFile[]> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
      SELECT * FROM source_files WHERE document_id = ${documentId} ORDER BY created_at
    `;

  const rows = extractRows(result);
  return rows.map((row: any) => {
    const baseFile = {
      id: row.id,
      fileType: row.file_type as "image" | "pdf" | "document",
      fileName: row.file_name,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      createdAt: new Date(row.created_at),
      documentId: row.document_id,
    };

    if (row.file_type === "drive") {
      return {
        ...baseFile,
        type: "drive" as const,
        driveFileId: row.drive_file_id,
        webViewLink: row.web_view_link,
        webContentLink: row.web_content_link,
      } as DriveSourceFile;
    } else {
      return {
        ...baseFile,
        type: "local" as const,
        filePath: row.file_path,
      } as LocalSourceFile;
    }
  });
}

// Document Sharing Methods - Read
export async function getDocumentShares(documentId: string): Promise<DocumentShare[]> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
      SELECT * FROM document_shares WHERE document_id = ${documentId} ORDER BY created_at
    `;

  const rows = extractRows(result);
  return rows.map((row: any) => ({
    id: row.id,
    documentId: row.document_id,
    ownerUserId: row.owner_user_id,
    sharedUserEmail: row.shared_user_id,
    permission: row.permission,
    allowGuestAccess: row.allow_guest_access || false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function getDocumentAccessList(documentId: string): Promise<{
  owner: string;
  sharedUsers: Array<{ email: string; permission: PermissionLevel }>;
  allowGuestAccess: boolean;
}> {
  const sqlInstance = await getSqlInstance();

  // Get document owner
  const ownerResult = await sqlInstance`
      SELECT user_id FROM documents WHERE id = ${documentId}
    `;

  if (!Array.isArray(ownerResult) || ownerResult.length === 0) {
    throw new Error("Document not found");
  }

  const ownerId = (ownerResult[0] as any).user_id;

  // Get all shared users (excluding guest access entries)
  const sharesResult = await sqlInstance`
      SELECT shared_user_id, permission FROM document_shares
      WHERE document_id = ${documentId} AND shared_user_id IS NOT NULL
      ORDER BY created_at
    `;

  const sharedUsers = Array.isArray(sharesResult)
    ? sharesResult.map((row: any) => ({
        email: row.shared_user_id,
        permission: row.permission as PermissionLevel,
      }))
    : [];

  // Check guest access
  const guestResult = await sqlInstance`
      SELECT allow_guest_access FROM document_shares
      WHERE document_id = ${documentId} AND shared_user_id IS NULL
    `;

  const allowGuestAccess =
    Array.isArray(guestResult) && guestResult.length > 0 ? (guestResult[0] as any).allow_guest_access || false : false;

  return {
    owner: ownerId,
    sharedUsers,
    allowGuestAccess,
  };
}

export async function getUserSharedDocuments(
  userEmail: string,
): Promise<Array<{ document: Document; permission: "view" | "edit" }>> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
      SELECT d.*, ds.permission, ds.owner_user_id
      FROM documents d
      JOIN document_shares ds ON d.id = ds.document_id
      WHERE ds.shared_user_id = ${userEmail}
      ORDER BY d.updated_at DESC
    `;

  const rows = extractRows(result);
  return rows.map((row: any) => ({
    document: {
      id: row.id,
      title: row.title,
      content: row.content || "",
      contentHtml: row.content_html,
      contentJson: row.content_json
        ? typeof row.content_json === "string"
          ? row.content_json
          : JSON.stringify(row.content_json)
        : undefined, // Use JSON content when available
      pageIds: [],
      sourceFileIds: [],
      hasBeenEntered: row.has_been_entered,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      // Temporary document fields
      isTemporary: row.is_temporary || false,
      anonymousSessionId: row.anonymous_session_id || undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      claimedAt: row.claimed_at ? new Date(row.claimed_at) : undefined,
    },
    permission: row.permission,
  }));
}

type CheckUserAccessParams = {
  documentId: string;
  userId: string | null;
};

export async function checkUserAccess({
  documentId,
  userId,
}: CheckUserAccessParams): Promise<{ hasAccess: boolean; permission: PermissionLevel; isOwner: boolean }> {
  const sqlInstance = await getSqlInstance();

  // Check if user is admin first - admins have access to all documents
  if (userId) {
    const adminResult = await sqlInstance`
        SELECT ar.id FROM admin_roles ar WHERE ar.user_id = ${userId} AND ar.is_active = true LIMIT 1
      `;

    const adminRows = Array.isArray(adminResult)
      ? adminResult
      : adminResult && typeof adminResult === "object" && "rows" in adminResult
        ? (adminResult as any).rows
        : [];

    if (adminRows.length > 0) {
      return { hasAccess: true, permission: "owner", isOwner: false }; // Admin has owner permission but not document owner
    }
  }

  // First check if user is the owner (user_id is a UUID that references users.id)
  // Use SQL comparison to ensure proper UUID type handling
  if (userId) {
    const ownerResult = await sqlInstance`
        SELECT id, user_id FROM documents WHERE id = ${documentId}
      `;

    // Handle both array result (Neon) and Result object (pg)
    let ownerRows = [];
    if (Array.isArray(ownerResult)) {
      ownerRows = ownerResult;
    } else if (ownerResult && typeof ownerResult === "object" && "rows" in ownerResult) {
      ownerRows = (ownerResult as any).rows;
    }

    if (ownerRows.length > 0) {
      const docUserId = (ownerRows[0] as any).user_id;
      // Normalize UUIDs for comparison (handle string vs UUID object)
      const normalizedDocUserId = String(docUserId).toLowerCase().trim();
      const normalizedUserId = String(userId).toLowerCase().trim();

      // Check if userId matches the document's user_id (normalized comparison)
      if (normalizedDocUserId === normalizedUserId) {
        return { hasAccess: true, permission: "owner", isOwner: true };
      }
    } else {
      console.log("DB: OWNERSHIP-CHECK: Document not found", { documentId });
    }
  }

  // Check if user has been explicitly shared with
  if (userId) {
    const shareResult = await sqlInstance`
      SELECT permission, owner_user_id, shared_user_id FROM document_shares
      WHERE document_id = ${documentId} AND shared_user_id = ${userId}
    `;

    // Handle both array result (Neon) and Result object (pg)
    let shareRows = [];
    if (Array.isArray(shareResult)) {
      shareRows = shareResult;
    } else if (shareResult && typeof shareResult === "object" && "rows" in shareResult) {
      shareRows = (shareResult as any).rows;
    }

    if (shareRows.length > 0) {
      const shareRow = shareRows[0] as any;
      const permission = shareRow.permission as PermissionLevel;

      // If user has 'owner' permission via share, they are the document owner
      // Since we're querying WHERE shared_user_id = userId, if permission is 'owner', they own it
      const isOwnerViaShare = permission === "owner";

      return {
        hasAccess: true,
        permission,
        isOwner: isOwnerViaShare,
      };
    } else {
      console.log("DB: SHARE-CHECK: No share entry found", { documentId, userId });
    }
  }

  // Check if guest access is enabled
  const guestResult = await sqlInstance`
      SELECT allow_guest_access FROM document_shares
      WHERE document_id = ${documentId} AND shared_user_id IS NULL
    `;

  // Handle both array result (Neon) and Result object (pg)
  let guestRows = [];
  if (Array.isArray(guestResult)) {
    guestRows = guestResult;
  } else if (guestResult && typeof guestResult === "object" && "rows" in guestResult) {
    guestRows = (guestResult as any).rows;
  }

  if (guestRows.length > 0) {
    const allowGuestAccess = (guestRows[0] as any).allow_guest_access;
    if (allowGuestAccess && !userId) {
      return { hasAccess: true, permission: "viewer", isOwner: false };
    }
  }

  return { hasAccess: false, permission: "viewer", isOwner: false };
}

export async function getGuestAccessSettings(documentId: string): Promise<{ allowGuestAccess: boolean }> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
      SELECT allow_guest_access FROM document_shares
      WHERE document_id = ${documentId} AND shared_user_id IS NULL
    `;

  const rows = extractRows(result);
  if (rows.length === 0) {
    return { allowGuestAccess: false };
  }

  const row = rows[0] as any;
  return {
    allowGuestAccess: row.allow_guest_access || false,
  };
}

// Real-time Collaboration Methods - Read
export async function getActiveSessions(documentId: string): Promise<DocumentSession[]> {
  const sqlInstance = await getSqlInstance();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

  const result = await sqlInstance`
      SELECT * FROM document_sessions
      WHERE document_id = ${documentId} AND last_active_at > ${fiveMinutesAgo}
      ORDER BY last_active_at DESC
    `;

  const rows = extractRows(result);
  return rows.map((row: any) => ({
    id: row.id,
    documentId: row.document_id,
    userId: row.user_id,
    userName: row.user_name,
    lastActiveAt: new Date(row.last_active_at),
    cursorPosition: row.cursor_position,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }));
}

export async function getDocumentChanges(documentId: string, sinceVersion: number = 0): Promise<DocumentChange[]> {
  const sqlInstance = await getSqlInstance();
  const result = await sqlInstance`
    SELECT * FROM document_changes
    WHERE document_id = ${documentId} AND version > ${sinceVersion}
    ORDER BY version ASC
  `;

  const rows = extractRows(result);
  return rows.map((row: any) => ({
    id: row.id,
    documentId: row.document_id,
    sessionId: row.session_id,
    userId: row.user_id,
    version: row.version,
    operation: row.operation,
    createdAt: new Date(row.created_at),
  }));
}

/**
 * Get document count for a user (for statistics)
 */
export async function getDocumentCount(userId: string): Promise<number> {
  const sqlInstance = await getSqlInstance();

  try {
    const documentCountResult = await sqlInstance`
      SELECT COUNT(*) as count
      FROM documents
      WHERE user_id = ${userId}
    `;
    const rows = extractRows(documentCountResult);
    const countResult = rows[0] as { count: number } | undefined;
    return Number(countResult?.count) || 0;
  } catch (_error) {
    console.log("No documents found for user:", userId);
    return 0;
  }
}
