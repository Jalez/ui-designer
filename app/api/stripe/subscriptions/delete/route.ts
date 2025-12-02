import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/app/api/_lib/middleware/auth";
import { createNextResponse, logWithContext } from "@/app/api/_lib/errorHandler";
import { cancelUserSubscription } from "@/app/api/_lib/services/stripeService/subscriptionService";
import type { Session } from "next-auth";

export const DELETE = withAuth(async (_request: NextRequest, _context, session: Session) => {
  const requestId = randomUUID();

  try {
    const userEmail = session.user.email;
    // Cancel user's subscription in database
    await cancelUserSubscription(userEmail);

    logWithContext("info", "subscription-cancelled", "Subscription cancelled successfully", { userEmail }, requestId);
    return NextResponse.json({
      message: "Subscription cancelled successfully",
      cancelAtPeriodEnd: true,
    });
  } catch (error) {
    logWithContext(
      "error",
      "subscription-cancel-failed",
      "Failed to cancel subscription",
      {
        error: error instanceof Error ? error.message : String(error),
        userEmail: session?.user?.email,
      },
      requestId,
    );
    return createNextResponse(error as Error, requestId);
  }
});
