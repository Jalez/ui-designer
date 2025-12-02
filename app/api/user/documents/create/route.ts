import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { DocumentService } from "@/app/api/_lib/services/documentService";

// POST - Create document owned by specified user (user or admin access)
export const POST = withAdminOrUserAuth(async (request: NextRequest, _context, session: Session, _isSelf) => {
  try {
    const userId = session?.userId;
    const body = await request.json();
    const { title, isTemporary, anonymousSessionId } = body;

    // Handle temporary documents for unauthenticated users
    if (!session?.user?.email) {
      if (!isTemporary || !anonymousSessionId) {
        return NextResponse.json({ error: "Authentication required for permanent documents" }, { status: 401 });
      }

      // Validate anonymous session ID format
      if (!/^anon_\d+_[a-z0-9]+$/.test(anonymousSessionId)) {
        return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
      }

      console.log(`📝 Creating temporary document for anonymous session: ${anonymousSessionId}`);

      const document = await DocumentService.createDocument({
        userId: anonymousSessionId,
        titleOrOptions: {
          title: title || "New Document",
          isTemporary: true,
          anonymousSessionId,
          expirationHours: 1, // 1 hour expiration
        },
      });

      return NextResponse.json(document);
    }

    // Authenticated users create permanent documents
    // Reject if they try to create temporary documents
    if (isTemporary) {
      return NextResponse.json({ error: "Authenticated users cannot create temporary documents" }, { status: 400 });
    }

    const document = await DocumentService.createDocument({
      userId,
      titleOrOptions: {
        title: title || "New Document",
        isTemporary: false,
      },
    });

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error creating document:", error);
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }
});
