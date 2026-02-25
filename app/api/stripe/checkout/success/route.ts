import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type Stripe from "stripe";
import { logWithContext } from "@/app/api/_lib/errorHandler";
import { getCreditService } from "@/app/api/_lib/services/creditService";
import { getStripeInstance } from "@/app/api/_lib/services/stripeService";
import type { AuthSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get("session_id");
  let session: AuthSession | null = null;

  if (!sessionId) {
    logWithContext("warn", "success-missing-session", "Session ID parameter is required", {}, requestId);
    return NextResponse.redirect(new URL("/subscription?error=missing_session", request.url));
  }

  try {
    session = (await getServerSession(authOptions)) as AuthSession;

    if (!session?.user?.email) {
      logWithContext(
        "warn",
        "success-auth-required",
        "Authentication required for success processing",
        { sessionId },
        requestId,
      );
      return NextResponse.redirect(new URL("/subscription?error=authentication_required", request.url));
    }

    logWithContext("info", "success-processing", "Processing successful payment", { sessionId }, requestId);

    // Verify the session with Stripe
    const stripe = getStripeInstance();
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "payment_intent"],
    });

    // Check if the checkout session was completed successfully
    if (stripeSession.status !== "complete") {
      logWithContext(
        "error",
        "success-session-incomplete",
        "Checkout session not completed",
        { sessionId, status: stripeSession.status },
        requestId,
      );
      return NextResponse.redirect(new URL("/subscription?error=payment_not_completed", request.url));
    }

    // For subscription payments, verify the subscription exists and is active
    if (stripeSession.mode === "subscription" && stripeSession.subscription) {
      const subscription = stripeSession.subscription as Stripe.Subscription;
      if (subscription.status !== "active" && subscription.status !== "trialing") {
        logWithContext(
          "error",
          "success-subscription-inactive",
          "Subscription not active",
          { sessionId, subscriptionStatus: subscription.status },
          requestId,
        );
        return NextResponse.redirect(new URL("/subscription?error=subscription_not_active", request.url));
      }
    }

    // For one-time payments, verify payment intent succeeded
    if (stripeSession.mode === "payment" && stripeSession.payment_intent) {
      const paymentIntent = stripeSession.payment_intent as Stripe.PaymentIntent;
      if (paymentIntent.status !== "succeeded") {
        logWithContext(
          "error",
          "success-payment-failed",
          "Payment not succeeded",
          { sessionId, paymentIntentStatus: paymentIntent.status },
          requestId,
        );
        return NextResponse.redirect(new URL("/subscription?error=payment_failed", request.url));
      }
    }

    //Verify the credits are set correctly

    // Log successful payment processing
    logWithContext("info", "success-verified", "Payment verification successful", { sessionId }, requestId);

    // Determine redirect parameters based on session metadata
    const isPlanChange = stripeSession.metadata?.isPlanChange === "true";
    let redirectUrl = `/subscription/success?session_id=${sessionId}`;

    if (isPlanChange) {
      redirectUrl += `&plan_change=true`;
    }

    // Redirect to success page - credit allocation is handled by webhooks
    logWithContext("info", "success-redirecting", "Redirecting to success page", { redirectUrl }, requestId);
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    logWithContext(
      "error",
      "success-processing-failed",
      "Error processing successful payment",
      {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        userEmail: session?.user?.email,
      },
      requestId,
    );
    return NextResponse.redirect(new URL("/subscription?error=payment_processing_failed", request.url));
  }
}
