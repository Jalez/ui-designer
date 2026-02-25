import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { AppError, createNextResponse, ERROR_CODES, logWithContext } from "@/app/api/_lib/errorHandler";
import { createCheckoutSession, getPlanFromPriceId } from "@/app/api/_lib/services/stripeService";
import { commonValidationRules, createValidationError, validateJsonRequest } from "@/app/api/_lib/validation";
import type { AuthSession } from "@/lib/auth";
import { authOptions } from "@/lib/auth";
import { getCreditService, getMonthlyCreditsFromPriceId } from "../../_lib/services/creditService";
import { getUserPlan, getLastActivePlan } from "../../_lib/services/planService";
import { getOrCreateUserByEmail } from "../../_lib/services/userService";

export async function POST(request: NextRequest) {
  const requestId = randomUUID();
  let session: AuthSession | null = null;

  try {
    session = (await getServerSession(authOptions)) as AuthSession;

    if (!session?.user?.email) {
      const error = new AppError("Authentication required", ERROR_CODES.AUTHENTICATION_ERROR, 401);
      logWithContext("warn", "checkout-auth-required", "Authentication required for checkout", {}, requestId);
      return createNextResponse(error, requestId);
    }

    // Validate request body
    const validationResult = await validateJsonRequest(request, [
      commonValidationRules.priceId(),
      commonValidationRules.planId(),
    ]);

    if (!validationResult.isValid) {
      const error = createValidationError(validationResult.errors);
      logWithContext(
        "warn",
        "checkout-validation-failed",
        "Request validation failed",
        {
          errors: validationResult.errors,
        },
        requestId,
      );
      return createNextResponse(error, requestId);
    }

    const { priceId } = validationResult.data;

    // Map the plan ID to a valid plan type
    const planName = await getPlanFromPriceId(priceId);

    // Get or create user to ensure we have a userId
    const user = await getOrCreateUserByEmail(session.user.email);

    // Check if user already has a subscription
    const userPlan = await getUserPlan(user.id);

    // For cancelled subscriptions, try to get the last active plan from history
    let effectivePreviousPlan = userPlan;
    if (userPlan?.planName?.endsWith("(Cancelled)") && userPlan.stripeCustomerId) {
      // User has a cancelled subscription, check if they had a previous paid plan
      const lastActivePlan = await getLastActivePlan(session.user.email);
      if (lastActivePlan) {
        console.log("CHECKOUT-LAST-ACTIVE-PLAN:", lastActivePlan);
        // Use the last active plan as the "previous" plan for comparison
        effectivePreviousPlan = {
          ...userPlan,
          planName: lastActivePlan.planName,
          monthlyCredits: lastActivePlan.monthlyCredits,
        };
      }
    }

    console.log("CHECKOUT-USER-PLAN:", {
      userEmail: session.user.email,
      userPlan: userPlan
        ? {
            planName: userPlan.planName,
            monthlyCredits: userPlan.monthlyCredits,
            stripeCustomerId: userPlan.stripeCustomerId,
            stripeSubscriptionId: userPlan.stripeSubscriptionId,
          }
        : null,
      effectivePreviousPlan: effectivePreviousPlan
        ? {
            planName: effectivePreviousPlan.planName,
            monthlyCredits: effectivePreviousPlan.monthlyCredits,
          }
        : null,
    });

    // Ensure we have a valid base URL for production
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!baseUrl.startsWith("http")) {
      const error = new AppError("Server configuration error", ERROR_CODES.INTERNAL_ERROR, 500, {
        issue: "NEXT_PUBLIC_APP_URL must include http:// or https:// scheme",
      });
      logWithContext(
        "error",
        "checkout-config-error",
        "Invalid NEXT_PUBLIC_APP_URL configuration",
        { baseUrl },
        requestId,
      );
      return createNextResponse(error, requestId);
    }

    // If user already has a subscription, check if it's the same plan
    if (userPlan?.stripeCustomerId && userPlan.planName === planName) {
      const error = new AppError("You already have this plan", ERROR_CODES.VALIDATION_ERROR, 400, {
        currentPlan: planName,
        message: `You are already subscribed to the ${planName} plan`,
      });
      logWithContext(
        "info",
        "checkout-duplicate-plan",
        "User already has this plan",
        { planName, userEmail: session.user.email },
        requestId,
      );
      return createNextResponse(error, requestId);
    }

    // Determine if this is a plan change
    // Check if user has active subscriptions - cancelled subscriptions can't be migrated
    let isPlanChange = false;
    let hasActiveSubscription = false;

    if (userPlan?.stripeCustomerId) {
      try {
        const { getStripeInstance } = await import("@/app/api/_lib/services/stripeService");
        const stripe = getStripeInstance();

        // Check if customer has any active subscriptions
        const activeSubscriptions = await stripe.subscriptions.list({
          customer: userPlan.stripeCustomerId,
          status: "active",
          limit: 1,
        });

        hasActiveSubscription = activeSubscriptions.data.length > 0;
        isPlanChange = hasActiveSubscription;
      } catch (error) {
        console.warn("Failed to check for active subscriptions:", error);
        // Fall back to assuming it's a plan change if we have a customer ID
        isPlanChange = true;
      }
    }

    console.log("CHECKOUT-PLAN-CHANGE-DETECTION:", {
      isPlanChange,
      hasStripeCustomerId: !!userPlan?.stripeCustomerId,
      hasActiveSubscription,
      hasStripeSubscriptionId: !!userPlan?.stripeSubscriptionId,
      planName,
      userPlanStatus: userPlan?.planName,
    });

    // For plan changes, check if this is a downgrade
    let isDowngrade = false;
    if (isPlanChange && effectivePreviousPlan?.monthlyCredits) {
      // Get the new plan's monthly credits
      const creditService = getCreditService();
      const newMonthlyCredits = await getMonthlyCreditsFromPriceId(priceId);
      isDowngrade = newMonthlyCredits < effectivePreviousPlan.monthlyCredits;
      console.log(
        `Plan change detected: ${isDowngrade ? "DOWNGRADE" : "UPGRADE"} from ${effectivePreviousPlan.monthlyCredits} to ${newMonthlyCredits} credits`,
      );
    }

    // Use the checkout service to create the session
    const result = await createCheckoutSession({
      priceId,
      planName,
      userEmail: session.user.email,
      baseUrl,
      isPlanChange,
      isDowngrade,
      existingCustomerId: userPlan?.stripeCustomerId,
      existingSubscriptionId: userPlan?.stripeSubscriptionId,
      previousPlanData: effectivePreviousPlan
        ? {
            planName: effectivePreviousPlan.planName || "",
            monthlyCredits: effectivePreviousPlan.monthlyCredits || 0,
            stripeMonthlyPriceId: effectivePreviousPlan.stripeMonthlyPriceId || "",
          }
        : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error creating checkout session:", error);
    logWithContext(
      "error",
      "checkout-session-creation-failed",
      "Failed to create checkout session",
      {
        error: error instanceof Error ? error.message : String(error),
        userEmail: session?.user?.email,
      },
      requestId,
    );
    return createNextResponse(error as Error, requestId);
  }
}
