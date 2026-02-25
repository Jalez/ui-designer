import type Stripe from "stripe";
import { getStripeInstance } from "./shared";

export interface CheckoutSessionConfig {
  priceId: string;
  planName: string;
  userEmail: string;
  baseUrl: string;
  isPlanChange?: boolean;
  isDowngrade?: boolean;
  existingCustomerId?: string;
  existingSubscriptionId?: string;
  previousPlanData?: {
    planName: string;
    monthlyCredits: number;
    stripeMonthlyPriceId: string;
  };
}

export interface CheckoutSessionResult {
  sessionId: string;
  url?: string;
  checkoutUrl?: string;
  isPortal: boolean;
}

export async function createCheckoutSession(config: CheckoutSessionConfig): Promise<CheckoutSessionResult> {
  const {
    priceId,
    planName,
    userEmail,
    baseUrl,
    isPlanChange = false,
    isDowngrade = false,
    existingCustomerId,
    existingSubscriptionId,
    previousPlanData,
  } = config;

  const stripe = getStripeInstance();

  // Base config - only include customer_email if we don't have an existing customer
  const baseConfig = {
    ...(existingCustomerId ? {} : { customer_email: userEmail }),
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription" as const,
    success_url: `${baseUrl}/api/stripe/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/subscription?canceled=true`,
    metadata: {
      userId: userEmail,
      planName: planName,
    },
    allow_promotion_codes: true,
  };

  // For existing customers doing plan changes (including resubscriptions from cancelled subscriptions)
  if (isPlanChange && existingCustomerId) {
    console.log(`Existing customer ${existingCustomerId} requesting plan change to ${planName}`);

    // For downgrades with active subscriptions, create a subscription schedule to defer the change
    if (isDowngrade && existingSubscriptionId) {
      // First check if the subscription is actually active (not cancelled)
      const currentSubscription = await stripe.subscriptions.retrieve(existingSubscriptionId);

      if (currentSubscription.status === "canceled") {
        console.log(
          `Subscription ${existingSubscriptionId} is cancelled, cannot create schedule. Treating as new subscription.`,
        );
        // Fall through to regular checkout session creation below
      } else {
        console.log(`Creating subscription schedule for downgrade to ${planName} (active subscription)`);

        const currentPeriodEnd = currentSubscription.items.data[0].current_period_end;
        console.log(`Current subscription period end: ${new Date(currentPeriodEnd * 1000).toISOString()}`);
        console.log(`Current time: ${new Date().toISOString()}`);
        console.log(`Time until period end: ${currentPeriodEnd - Math.floor(Date.now() / 1000)} seconds`);

        // Check for existing schedules by looking at subscription metadata or searching
        // We'll use a different approach - check if the subscription has schedule metadata
        let existingScheduleId: string | null = null;
        try {
          const schedules = await stripe.subscriptionSchedules.list();
          for (const schedule of schedules.data) {
            if (schedule.subscription === existingSubscriptionId) {
              existingScheduleId = schedule.id;
              break;
            }
          }
        } catch (error) {
          console.log("Error checking for existing schedules:", error);
        }

        if (existingScheduleId) {
          // Cancel the existing schedule first
          console.log(`Cancelling existing subscription schedule: ${existingScheduleId}`);
          await stripe.subscriptionSchedules.cancel(existingScheduleId);
        }

        // Create a subscription schedule with two phases:
        // Phase 1: Current plan until current_period_end
        // Phase 2: New plan starting at current_period_end, with iterations: 1, end_behavior: 'release'
        const subscriptionSchedule = await stripe.subscriptionSchedules.create({
          from_subscription: existingSubscriptionId,
        });

        // Update the schedule with phases
        await stripe.subscriptionSchedules.update(subscriptionSchedule.id, {
          phases: [
            {
              items: [
                {
                  price: (currentSubscription as Stripe.Subscription).items.data[0].price.id,
                  quantity: 1,
                },
              ],
              end_date: currentPeriodEnd,
            },
            {
              items: [
                {
                  price: priceId,
                  quantity: 1,
                },
              ],
              start_date: currentPeriodEnd,
              iterations: 1,
            },
          ],
          metadata: {
            userId: userEmail,
            planName: planName,
            isDowngrade: "true",
            oldSubscriptionId: existingSubscriptionId,
            previousPlanName: previousPlanData?.planName ?? "",
            previousMonthlyCredits:
              typeof previousPlanData?.monthlyCredits === "number" ? String(previousPlanData.monthlyCredits) : "",
            previousStripeMonthlyPriceId: previousPlanData?.stripeMonthlyPriceId ?? "",
          },
        });

        console.log(`Subscription schedule created for downgrade: ${subscriptionSchedule.id}`);

        // Return a result that redirects to success page (no payment needed for downgrade)
        return {
          isPortal: false,
          sessionId: subscriptionSchedule.id,
          url: `${baseUrl}/subscription/success?schedule_id=${subscriptionSchedule.id}&change_type=downgrade`,
        };
      }
    }

    // For resubscriptions (no active subscription) or upgrades, create a regular checkout session

    // For upgrades, create a regular checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: existingCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}&change_type=upgrade`,
      cancel_url: `${baseUrl}/subscription?canceled=true`,
      metadata: {
        userId: userEmail,
        planName: planName,
        isPlanChange: "true",
        oldSubscriptionId: existingSubscriptionId,
        previousPlanName: previousPlanData?.planName ?? "",
        previousMonthlyCredits:
          typeof previousPlanData?.monthlyCredits === "number" ? String(previousPlanData.monthlyCredits) : "",
        previousStripeMonthlyPriceId: previousPlanData?.stripeMonthlyPriceId ?? "",
      },
      subscription_data: {
        metadata: {
          userId: userEmail,
          planName: planName,
          isPlanChange: "true",
          oldSubscriptionId: existingSubscriptionId,
          previousPlanName: previousPlanData?.planName ?? "",
          previousMonthlyCredits:
            typeof previousPlanData?.monthlyCredits === "number" ? String(previousPlanData.monthlyCredits) : "",
          previousStripeMonthlyPriceId: previousPlanData?.stripeMonthlyPriceId ?? "",
        },
      },
    });

    console.log(`Checkout session created for plan change: ${checkoutSession.id}`);

    return {
      isPortal: false,
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    };
  }

  // For new customers or existing customers resubscribing (not plan changes)
  const finalConfig = existingCustomerId
    ? {
        ...baseConfig,
        customer: existingCustomerId,
        subscription_data: {
          metadata: {
            userId: userEmail,
            planName: planName,
            isResubscription: "true", // Mark as resubscription to trigger cleanup
            previousPlanName: previousPlanData?.planName ?? "",
            previousMonthlyCredits:
              typeof previousPlanData?.monthlyCredits === "number" ? String(previousPlanData.monthlyCredits) : "",
            previousStripeMonthlyPriceId: previousPlanData?.stripeMonthlyPriceId ?? "",
          },
        },
      }
    : {
        ...baseConfig,
        customer_email: userEmail, // Only add customer_email for truly new customers
      };

  const checkoutSession = await stripe.checkout.sessions.create(finalConfig as Stripe.Checkout.SessionCreateParams);

  console.log(`Checkout session created successfully: ${checkoutSession.id}`);

  return {
    isPortal: false,
    sessionId: checkoutSession.id,
    url: checkoutSession.url,
  };
}
