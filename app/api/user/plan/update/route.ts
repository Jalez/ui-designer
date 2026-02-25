import { type NextRequest, NextResponse } from "next/server";
import { withAdminOrUserAuth } from "@/app/api/_lib/middleware/admin";
import { createPaidSubscription } from "@/app/api/_lib/services/stripeService/subscriptionService";

// PUT - Update user's plan assignment
export const PUT = withAdminOrUserAuth(async (request: NextRequest, context) => {
  try {
    const userEmail = context.params.userEmail;
    const { stripeMonthlyPriceId } = await request.json();

    if (!stripeMonthlyPriceId) {
      return NextResponse.json(
        { error: "stripeMonthlyPriceId is required" },
        { status: 400 }
      );
    }

    // Create or update Stripe subscription for the user
    const result = await createPaidSubscription(userEmail, stripeMonthlyPriceId);
    return NextResponse.json({ success: true, subscription: result });

  } catch (error) {
    console.error("Admin user plan update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
