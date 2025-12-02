import type { Document } from "@/components/scriba/document";
import { getSqlInstance } from "../../db/shared";
import type { PermissionLevel } from "./types";

// Update a document
export async function updateDocument(documentId: string, userId: string, updates: Partial<Document>): Promise<void> {
  // Validate inputs
  if (!documentId || typeof documentId !== "string") {
    throw new Error("Invalid document ID");
  }

  if (!userId || typeof userId !== "string") {
    throw new Error("Invalid user ID");
  }

  // Check if user has edit permission (editor or owner)
  const { checkDocumentPermission } = await import("./read");
  const permissionInfo = await checkDocumentPermission({
    documentId,
    userId,
    requiredPermission: "editor",
  });

  if (!permissionInfo.hasAccess) {
    throw new Error("Insufficient permissions to edit this document");
  }

  const sqlInstance = await getSqlInstance();

  // Build dynamic update query based on provided fields
  const updateFields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.title !== undefined) {
    updateFields.push(`title = $${paramIndex++}`);
    values.push(updates.title);
  }
  if (updates.content !== undefined) {
    updateFields.push(`content = $${paramIndex++}`);
    values.push(updates.content);
  }
  if (updates.contentHtml !== undefined) {
    updateFields.push(`content_html = $${paramIndex++}`);
    values.push(updates.contentHtml);
  }
  if (updates.hasBeenEntered !== undefined) {
    updateFields.push(`has_been_entered = $${paramIndex++}`);
    values.push(updates.hasBeenEntered);
  }

  // Always update the updated_at timestamp
  updateFields.push(`updated_at = NOW()`);

  // Handle content_json separately due to potential column availability issues
  if (updates.contentJson !== undefined) {
    try {
      await sqlInstance`
        UPDATE documents
        SET content_json = ${updates.contentJson}, updated_at = NOW()
        WHERE id = ${documentId}
      `;
    } catch (error) {
      // Handle case where content_json column doesn't exist yet
      console.warn("⚠️ DocumentService: content_json column not available yet, skipping JSON update:", error.message);
    }
  }

  // Execute the main update if there are fields to update
  if (updateFields.length > 1) {
    // More than just updated_at
    const query = `
      UPDATE documents
      SET ${updateFields.join(", ")}
      WHERE id = $${paramIndex}
    `;
    values.push(documentId);

    try {
      await sqlInstance.query(query, values);
    } catch (error) {
      console.error("❌ DocumentService: Database update failed:", error);
      throw new Error("Failed to update document");
    }
  }
}

// Real-time Collaboration Methods - Update
export async function updateSessionActivity(sessionId: string, cursorPosition?: any): Promise<void> {
  const sqlInstance = await getSqlInstance();
  const now = new Date();

  if (cursorPosition) {
    await sqlInstance`
        UPDATE document_sessions
        SET last_active_at = ${now}, cursor_position = ${JSON.stringify(cursorPosition)}, updated_at = ${now}
        WHERE id = ${sessionId}
      `;
  } else {
    await sqlInstance`
        UPDATE document_sessions
        SET last_active_at = ${now}, updated_at = ${now}
        WHERE id = ${sessionId}
      `;
  }
}

// Document Sharing Methods - Update
export async function updateDocumentShare(
  documentId: string,
  sharedUserEmail: string,
  permission: PermissionLevel,
): Promise<void> {
  const sqlInstance = await getSqlInstance();
  const now = new Date();

  await sqlInstance`
    UPDATE document_shares
    SET permission = ${permission}, updated_at = ${now}
    WHERE document_id = ${documentId} AND shared_user_id = ${sharedUserEmail}
  `;
}

export async function setGuestAccess(
  documentId: string,
  ownerUserId: string,
  allowGuestAccess: boolean,
): Promise<void> {
  const sqlInstance = await getSqlInstance();

  // First check if a share entry exists for this document
  const existingResult = await sqlInstance`
      SELECT id FROM document_shares WHERE document_id = ${documentId} AND owner_user_id = ${ownerUserId}
    `;

  if (Array.isArray(existingResult) && existingResult.length > 0) {
    // Update existing entry
    await sqlInstance`
        UPDATE document_shares
        SET allow_guest_access = ${allowGuestAccess}, updated_at = NOW()
        WHERE document_id = ${documentId} AND owner_user_id = ${ownerUserId}
      `;
  } else {
    // Create new entry for guest access settings
    const id = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    await sqlInstance`
        INSERT INTO document_shares (
          id, document_id, owner_user_id, shared_user_id, permission, allow_guest_access, created_at, updated_at
        ) VALUES (
          ${id}, ${documentId}, ${ownerUserId}, NULL, 'viewer', ${allowGuestAccess}, ${now}, ${now}
        )
      `;
  }
}
