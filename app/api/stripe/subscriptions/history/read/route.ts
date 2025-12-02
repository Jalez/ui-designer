import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/api/_lib/middleware/auth";
import { createNextResponse, logWithContext } from "@/app/api/_lib/errorHandler";
import { getBillingHistory } from "@/app/api/_lib/services/stripeService";
import type { Session } from "next-auth";

export const GET = withAuth(async (_request: NextRequest, _context, session: Session) => {
  const requestId = randomUUID();
  let userEmail: string;

  try {
    userEmail = session.user.email;

    // Use the billing history service
    const invoices = await getBillingHistory(userEmail);

    logWithContext(
      "info",
      "billing-history-returned",
      "Billing history retrieved successfully",
      { userEmail, invoiceCount: invoices.length },
      requestId,
    );

    return NextResponse.json({
      invoices,
      hasMore: false, // Service doesn't return hasMore, keeping for compatibility
    });
  } catch (error) {
    logWithContext(
      "error",
      "billing-history-fetch-failed",
      "Failed to fetch billing history",
      {
        error: error instanceof Error ? error.message : String(error),
        userEmail,
      },
      requestId,
    );
    return createNextResponse(error as Error, requestId);
  }
});
