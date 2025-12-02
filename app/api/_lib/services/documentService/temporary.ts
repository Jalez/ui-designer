import { getSqlInstance } from "../../db/shared";

/**
 * Extends the expiration time of a temporary document
 * Called when the document is updated to keep it alive
 */
export async function extendTemporaryDocumentExpiration(documentId: string, hoursToAdd: number = 1): Promise<void> {
  try {
    const sqlInstance = await getSqlInstance();
    const newExpiration = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);

    const _result = await sqlInstance`
      UPDATE documents
      SET expires_at = ${newExpiration},
          updated_at = NOW()
      WHERE id = ${documentId}
        AND is_temporary = TRUE
        AND expires_at IS NOT NULL
    `;

    console.log(`⏰ Extended expiration for temporary document ${documentId} to ${newExpiration.toISOString()}`);
  } catch (error) {
    console.error(`❌ Failed to extend expiration for document ${documentId}:`, error);
  }
}

/**
 * Checks if a document is temporary and still valid
 */
export async function isTemporaryDocumentValid(documentId: string): Promise<boolean> {
  try {
    const sqlInstance = await getSqlInstance();

    const result = await sqlInstance`
      SELECT id
      FROM documents
      WHERE id = ${documentId}
        AND is_temporary = TRUE
        AND expires_at > NOW()
    `;

    const rows = Array.isArray(result) ? result : [];
    return rows.length > 0;
  } catch (error) {
    console.error(`❌ Error checking temporary document validity:`, error);
    return false;
  }
}

/**
 * Claims temporary documents for an authenticated user
 * Transfers ownership from anonymous session to authenticated user
 */
export async function claimTemporaryDocuments(
  anonymousSessionId: string,
  userEmail: string,
): Promise<{
  claimedCount: number;
  documents: Array<{ id: string; title: string }>;
}> {
  try {
    const sqlInstance = await getSqlInstance();
    const now = new Date();

    console.log(`📝 Claiming temporary documents for session: ${anonymousSessionId} by user: ${userEmail}`);

    // Find all temporary documents for this anonymous session
    const tempDocs = await sqlInstance`
      SELECT id, title, created_at
      FROM documents
      WHERE is_temporary = TRUE
        AND anonymous_session_id = ${anonymousSessionId}
        AND expires_at > NOW()
    `;

    const documents = Array.isArray(tempDocs) ? tempDocs : [];

    if (documents.length === 0) {
      console.log(`ℹ️  No temporary documents found for session: ${anonymousSessionId}`);
      return {
        claimedCount: 0,
        documents: [],
      };
    }

    console.log(`📋 Found ${documents.length} temporary document(s) to claim`);

    // Claim each document
    for (const doc of documents) {
      try {
        // Update the document to be permanent
        await sqlInstance`
          UPDATE documents
          SET user_id = ${userEmail},
              is_temporary = FALSE,
              claimed_at = ${now},
              expires_at = NULL,
              anonymous_session_id = NULL
          WHERE id = ${doc.id}
        `;

        // Update document_shares to reflect ownership
        // First, check if a share entry exists
        const existingShare = await sqlInstance`
          SELECT id FROM document_shares
          WHERE document_id = ${doc.id}
            AND shared_user_id = ${anonymousSessionId}
        `;

        if (Array.isArray(existingShare) && existingShare.length > 0) {
          // Update existing share
          await sqlInstance`
            UPDATE document_shares
            SET owner_user_id = ${userEmail},
                shared_user_id = ${userEmail},
                permission = 'owner',
                updated_at = ${now}
            WHERE document_id = ${doc.id}
              AND shared_user_id = ${anonymousSessionId}
          `;
        } else {
          // Create new share entry
          const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await sqlInstance`
            INSERT INTO document_shares (id, document_id, owner_user_id, shared_user_id, permission, created_at, updated_at)
            VALUES (${shareId}, ${doc.id}, ${userEmail}, ${userEmail}, 'owner', ${now}, ${now})
          `;
        }

        console.log(`✅ Claimed document: ${doc.id} - ${doc.title}`);
      } catch (error) {
        console.error(`❌ Error claiming document ${doc.id}:`, error);
      }
    }

    console.log(`✅ Successfully claimed ${documents.length} document(s)`);

    return {
      claimedCount: documents.length,
      documents: documents.map((d) => ({ id: d.id, title: d.title })),
    };
  } catch (error) {
    console.error("❌ Error claiming temporary documents:", error);
    throw error;
  }
}
