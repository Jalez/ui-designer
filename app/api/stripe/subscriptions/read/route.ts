import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { createNextResponse, logWithContext } from "@/app/api/_lib/errorHandler";
import { withAuth } from "@/app/api/_lib/middleware/auth";
import { getSubscriptionData } from "@/app/api/_lib/services/stripeService/subscriptionService";
import { ensureUserInitializedByEmail, updateUserStripeCustomerId } from "@/app/api/_lib/services/userService";

export const GET = withAuth(async (_request: NextRequest, _context, session: Session) => {
  const requestId = randomUUID();

  try {
    const userEmail = session.user.email;

    // Initialize user if not exists
    await ensureUserInitializedByEmail(userEmail);

    // Get subscription data using the service
    const subscriptionData = await getSubscriptionData(userEmail);

    // Check if user has a subscription - if so, ensure stripe_customer_id is stored
    if (subscriptionData.stripeCustomerId && subscriptionData.status === "active") {
      await updateUserStripeCustomerId(userEmail, subscriptionData.stripeCustomerId);
      logWithContext(
        "info",
        "subscription-customer-id-updated",
        "Updated stripe_customer_id for user with active subscription",
        { userEmail, stripeCustomerId: subscriptionData.stripeCustomerId },
        requestId,
      );
    }

    return NextResponse.json(subscriptionData);
  } catch (error) {
    console.log("error", error);
    logWithContext(
      "error",
      "subscription-fetch-failed",
      "Failed to fetch subscription data",
      {
        error: error instanceof Error ? error.message : String(error),
        userEmail: session?.user?.email,
      },
      requestId,
    );
    return createNextResponse(error as Error, requestId);
  }
});
