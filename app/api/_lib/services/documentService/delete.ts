import { getSqlInstance } from "../../db/shared";

// Delete a document
export async function deleteDocument(documentId: string, userId: string): Promise<void> {
  // Only document owners can delete documents

  const { checkDocumentPermission } = await import("./read");
  const permissionInfo = await checkDocumentPermission({
    documentId,
    userId,
    requiredPermission: "owner",
  });
  if (!permissionInfo.hasAccess) {
    throw new Error("Only document owners can delete documents");
  }

  const sqlInstance = await getSqlInstance();
  await sqlInstance`
      DELETE FROM documents WHERE id = ${documentId} AND user_id = ${userId}
    `;
}

// Delete a source file
export async function deleteSourceFile(fileId: string): Promise<void> {
  const sqlInstance = await getSqlInstance();
  await sqlInstance`DELETE FROM source_files WHERE id = ${fileId}`;
}

// Document Sharing Methods - Delete
export async function removeDocumentShare(documentId: string, sharedUserEmail: string): Promise<void> {
  const sqlInstance = await getSqlInstance();
  await sqlInstance`      DELETE FROM document_shares WHERE document_id = ${documentId} AND shared_user_id = ${sharedUserEmail}
    `;
}

// Real-time Collaboration Methods - Delete
export async function removeSession(sessionId: string): Promise<void> {
  const sqlInstance = await getSqlInstance();
  await sqlInstance`DELETE FROM document_sessions WHERE id = ${sessionId}`;
}
