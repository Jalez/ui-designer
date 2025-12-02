import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { DocumentService } from "@/app/api/_lib/services/documentService";

// GET - List user's documents (user or admin access)
export const GET = withAdminOrUserAuth(async (_request: NextRequest, _context, session: Session, _isSelf) => {
  try {
    const userId = session.userId;

    // Get documents for the specified user
    const documents = await DocumentService.getDocuments(userId);

    return NextResponse.json({
      documents,
      userId,
      total: documents.length,
    });
  } catch (error) {
    console.error("Error fetching user documents:", error);
    return NextResponse.json({ error: "Failed to fetch user documents" }, { status: 500 });
  }
});
