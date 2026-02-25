import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { getCreditService } from "@/app/api/_lib/services/creditService";

export const GET = withAdminOrUserAuth(async (request: NextRequest, _context, session: Session, _isSelf) => {
  try {
    const userId = session.userId;
    const creditService = getCreditService();

    // Parse query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Get credit history
    const transactions = await creditService.getCreditHistory({ userId: userId, limit, offset });

    return NextResponse.json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.transactionType,
        serviceName: tx.serviceName,
        creditsUsed: tx.creditsUsed,
        creditsBefore: tx.creditsBefore,
        creditsAfter: tx.creditsAfter,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
      })),
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching credit history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
