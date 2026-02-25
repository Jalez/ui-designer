import { type NextRequest, NextResponse } from "next/server";
import type { AuthSession } from "@/lib/auth";
import { getCreditService } from "@/app/api/_lib/services/creditService";
import { getUserPlan } from "@/app/api/_lib/services/planService";
import { getOrCreateUserByEmail } from "@/app/api/_lib/services/userService";
import { createPortalSession } from "@/app/api/_lib/services/stripeService";
import { withAuth } from "@/app/api/_lib/middleware/auth";

export const POST = withAuth(async (_request: NextRequest, _context, session: AuthSession) => {
  try {

    // Get user's Stripe customer ID from database
    const user = await getOrCreateUserByEmail(session.user.email);
    const userPlan = await getUserPlan(user.id);

    if (!userPlan?.stripeCustomerId) {
      return NextResponse.json(
        {
          error: "No Stripe customer found. Please contact support.",
        },
        { status: 400 },
      );
    }

    // Ensure we have a valid base URL for production
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://your-production-domain.com";
    if (!baseUrl.startsWith("http")) {
      console.error("NEXT_PUBLIC_APP_URL must include http:// or https:// scheme");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Use the portal service to create the session
    const result = await createPortalSession({
      customerId: userPlan.stripeCustomerId,
      returnUrl: `${baseUrl}/subscription?portal_return=true`,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
});
