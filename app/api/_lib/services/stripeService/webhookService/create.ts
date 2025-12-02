import type Stripe from "stripe";
import { createFileLogger, getCurrentFilePath } from "@/lib/file-logger";
import { getCreditService } from "../../creditService";
import { refreshUserCredits } from "../../creditService/update";
import { getPlanService } from "../../planService";
import { ensureUserInitializedByEmail } from "../../userService";
import { getMonthlyCredits, getPlanName, getStripeInstance } from "../shared";
import { updateUserSubscription } from "../subscriptionService";

// Create a file-specific logger
const logger = createFileLogger(getCurrentFilePath(import.meta.url));

const stripe = getStripeInstance();

export async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  logger.log("SERVER: WEBHOOK-SUBSCRIPTION-CREATED: Processing new subscription:", subscription.id);

  if (!subscription.customer) {
    logger.error("SERVER: WEBHOOK-ERROR: No customer ID in subscription");
    return;
  }

  try {
    // Get customer details
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (customer.deleted || !("email" in customer) || !customer.email) {
      console.error("SERVER: WEBHOOK-ERROR: Customer not found or no email");
      return;
    }

    const userEmail = customer.email;

    // Make sure the user has baseline plan/credit records before applying updates
    const userId = await ensureUserInitializedByEmail(userEmail);

    const creditService = getCreditService();
    const planService = getPlanService();

    // Check if this is a plan change (has isPlanChange metadata or comes from a schedule)
    const metadata = subscription.metadata ?? {};
    logger.log("SERVER: WEBHOOK-METADATA: Subscription metadata:", JSON.stringify(metadata));
    let isPlanChange = metadata.isPlanChange === "true";
    const isResubscription = metadata.isResubscription === "true";
    let oldSubscriptionId = metadata.oldSubscriptionId;

    // Check if this subscription was created from a schedule (deferred plan change)
    let isFromSchedule = false;
    let scheduleMetadata = null;
    if (subscription.schedule) {
      try {
        const schedule = await stripe.subscriptionSchedules.retrieve(subscription.schedule as string);
        scheduleMetadata = schedule.metadata || {};
        isFromSchedule = true;
        console.log("SERVER: WEBHOOK-SCHEDULE: Subscription created from schedule:", schedule.id);
        console.log("SERVER: WEBHOOK-SCHEDULE-METADATA:", JSON.stringify(scheduleMetadata));

        // If it's from a schedule with downgrade metadata, treat it as a plan change
        if (scheduleMetadata.isDowngrade === "true") {
          isPlanChange = true;
          oldSubscriptionId = scheduleMetadata.oldSubscriptionId;
          console.log("SERVER: WEBHOOK-SCHEDULE: This is a deferred downgrade from subscription schedule");
        }
      } catch (error) {
        console.warn("SERVER: WEBHOOK-WARNING: Failed to retrieve schedule details:", error);
      }
    }

    console.log(
      "SERVER: WEBHOOK-PLAN-CHANGE: isPlanChange:",
      isPlanChange,
      "isResubscription:",
      isResubscription,
      "isFromSchedule:",
      isFromSchedule,
      "oldSubscriptionId:",
      oldSubscriptionId,
    );

    // For subscriptions created from schedules (deferred downgrades), defer processing to payment succeeded webhook
    if (isFromSchedule && scheduleMetadata?.isDowngrade === "true") {
      console.log(
        "SERVER: WEBHOOK-SCHEDULE: Deferring processing of subscription created from schedule - will be handled by payment succeeded webhook",
      );
      // Don't process this subscription creation - let the payment succeeded webhook handle the downgrade
      return;
    }

    let previousMonthlyCredits: number | null = null;
    let previousPlanName: string | null = null;

    if (isPlanChange) {
      // Use schedule metadata if available (preferred for deferred downgrades)
      if (isFromSchedule && scheduleMetadata) {
        if (scheduleMetadata.previousMonthlyCredits) {
          const parsed = Number(scheduleMetadata.previousMonthlyCredits);
          if (!Number.isNaN(parsed) && parsed > 0) {
            previousMonthlyCredits = parsed;
          }
        }

        if (scheduleMetadata.previousPlanName) {
          previousPlanName = scheduleMetadata.previousPlanName;
        }
      }

      // Fall back to subscription metadata
      if (!previousMonthlyCredits && metadata.previousMonthlyCredits) {
        const parsed = Number(metadata.previousMonthlyCredits);
        if (!Number.isNaN(parsed) && parsed > 0) {
          previousMonthlyCredits = parsed;
        }
      }

      if (!previousPlanName && metadata.previousPlanName) {
        previousPlanName = metadata.previousPlanName;
      }

      // Attempt to derive previous plan data from the old subscription if needed
      if ((!previousMonthlyCredits || previousMonthlyCredits <= 0) && oldSubscriptionId) {
        try {
          const oldSubscription = await stripe.subscriptions.retrieve(oldSubscriptionId, {
            expand: ["items.data.price"],
          });
          const oldPriceId = oldSubscription.items.data[0]?.price?.id;
          if (oldPriceId) {
            previousMonthlyCredits = await getMonthlyCredits(oldPriceId, planService, stripe);
            if (!previousPlanName) {
              previousPlanName = await getPlanName(oldPriceId, stripe);
            }
          }
        } catch (error) {
          console.warn("SERVER: WEBHOOK-WARNING: Failed to retrieve previous subscription details:", error);
        }
      }
    }

    // Get the price ID from the subscription
    const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) {
      console.error("SERVER: WEBHOOK-ERROR: No price ID found in subscription");
      return;
    }

    // Get plan name and credits from Stripe metadata (following cursor rules)
    const planName = await getPlanName(priceId, stripe);
    const monthlyCredits = await getMonthlyCredits(priceId, planService, stripe);
    const priceRecurringInterval = subscription.items.data[0]?.price?.recurring?.interval;

    console.log("SERVER: WEBHOOK-INFO: Using Stripe metadata - Plan:", planName, "Credits:", monthlyCredits);

    // For plan changes, determine if it's an upgrade or downgrade
    let isDowngrade = false;
    if (isPlanChange && previousMonthlyCredits && previousMonthlyCredits > 0) {
      isDowngrade = monthlyCredits < previousMonthlyCredits;
      console.log(
        `SERVER: WEBHOOK-PLAN-CHANGE: ${monthlyCredits > previousMonthlyCredits ? "UPGRADE" : isDowngrade ? "DOWNGRADE" : "SAME_LEVEL"} detected`,
      );
      console.log(
        `Previous plan credits: ${previousMonthlyCredits}, New plan credits: ${monthlyCredits}, Previous plan: ${previousPlanName ?? "Unknown"}`,
      );
    }

    // Update user subscription - for downgrades, keep the old plan information
    if (isDowngrade) {
      // For downgrades, only update subscription info, keep old plan
      console.log("SERVER: WEBHOOK-DOWNGRADE: Keeping existing plan, updating subscription info only");
      await updateUserSubscription(userEmail, {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        subscriptionStatus: subscription.status,
        currentPeriodStart: new Date((subscription.items.data[0]?.current_period_start || 0) * 1000),
        currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end || 0) * 1000),
        stripeMonthlyPriceId: priceRecurringInterval === "year" ? undefined : priceId,
        stripeYearlyPriceId: priceRecurringInterval === "year" ? priceId : undefined,
      });
    } else {
      // For upgrades and new subscriptions, update everything
      await updateUserSubscription(userEmail, {
        planName: planName,
        monthlyCredits: monthlyCredits,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        subscriptionStatus: subscription.status,
        currentPeriodStart: new Date((subscription.items.data[0]?.current_period_start || 0) * 1000),
        currentPeriodEnd: new Date((subscription.items.data[0]?.current_period_end || 0) * 1000),
        stripeMonthlyPriceId: priceRecurringInterval === "year" ? undefined : priceId,
        stripeYearlyPriceId: priceRecurringInterval === "year" ? priceId : undefined,
      });

      if (isPlanChange && previousMonthlyCredits && monthlyCredits > previousMonthlyCredits) {
        // Upgrade: Set credits immediately to new plan amount
        console.log("SERVER: WEBHOOK-UPGRADE: Setting credits to new plan amount immediately");
        await creditService.setCredits({
          userId,
          credits: monthlyCredits,
          metadata: {
            reason: "Plan upgrade - credits set to new plan amount immediately",
            stripeMonthlyPriceId: priceId,
            monthlyCredits: monthlyCredits,
            previousCredits: previousMonthlyCredits,
            isUpgrade: true,
            webhookProcessed: true,
            previousPlanName,
          },
        });
        console.log(`SERVER: WEBHOOK-SUCCESS: Credits upgraded from ${previousMonthlyCredits} to ${monthlyCredits}`);
      } else if (!isPlanChange) {
        // New subscription: Set credits to match the plan allocation immediately
        console.log("SERVER: WEBHOOK-NEW-SUBSCRIPTION: Setting credits to new plan amount for new subscription");
        await refreshUserCredits({ userId });
        console.log(`SERVER: WEBHOOK-SUCCESS: Credits set to ${monthlyCredits} for new subscription`);
      }
    }

    console.log("TIME TO CHECK FOR OTHER ACTIVE SUBSCRIPTIONS");
    if (isPlanChange || isResubscription) {
      console.log("SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Canceling other active subscriptions after successful update");

      // Cancel the specific old subscription if provided (handle errors gracefully)
      if (oldSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(oldSubscriptionId);
          console.log(`SERVER: WEBHOOK-SUCCESS: Canceled old subscription ${oldSubscriptionId}`);
        } catch (error) {
          // If the old subscription doesn't exist or is already cancelled, just log and continue
          if ((error as { code?: string }).code === "resource_missing") {
            console.log(
              `SERVER: WEBHOOK-INFO: Old subscription ${oldSubscriptionId} already cancelled or doesn't exist`,
            );
          } else {
            console.warn(`SERVER: WEBHOOK-WARNING: Failed to cancel old subscription ${oldSubscriptionId}:`, error);
          }
        }
      }

      // Always cancel any other active subscriptions for this customer (excluding the current one)
      try {
        const customerId = subscription.customer as string;
        if (!customerId) {
          console.error(
            `SERVER: WEBHOOK-ERROR: No customer ID found on subscription ${subscription.id} - cannot cancel other subscriptions safely`,
          );
          return;
        }

        console.log(
          `SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Checking for active subscriptions for customer ${customerId}`,
        );
        const activeSubscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
        });

        console.log(
          `SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Found ${activeSubscriptions.data.length} active subscriptions for customer ${customerId}`,
        );
        console.log(`SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Current subscription ID: ${subscription.id}`);

        for (const activeSub of activeSubscriptions.data) {
          console.log(
            `SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Examining subscription ${activeSub.id} (status: ${activeSub.status}, customer: ${activeSub.customer})`,
          );

          // Double-check that this subscription belongs to our customer
          if (activeSub.customer !== customerId) {
            console.warn(
              `SERVER: WEBHOOK-WARNING: Subscription ${activeSub.id} belongs to customer ${activeSub.customer}, not ${customerId} - skipping`,
            );
            continue;
          }

          // Don't cancel the subscription we just created
          if (activeSub.id !== subscription.id) {
            console.log(
              `SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Canceling additional active subscription ${activeSub.id} for customer ${customerId}`,
            );
            try {
              const cancelledSub = await stripe.subscriptions.cancel(activeSub.id);
              console.log(
                `SERVER: WEBHOOK-SUCCESS: Successfully cancelled subscription ${activeSub.id} in Stripe (new status: ${cancelledSub.status})`,
              );
            } catch (cancelError) {
              console.error(
                `SERVER: WEBHOOK-ERROR: Failed to cancel subscription ${activeSub.id} in Stripe:`,
                cancelError,
              );
            }
          } else {
            console.log(
              `SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Skipping current subscription ${activeSub.id} (just created)`,
            );
          }
        }

        console.log(
          `SERVER: WEBHOOK-SUBSCRIPTION-CLEANUP: Finished processing ${activeSubscriptions.data.length} active subscriptions`,
        );
      } catch (error) {
        console.warn("SERVER: WEBHOOK-WARNING: Failed to cancel additional subscriptions:", error);
      }
    }

    console.log("SERVER: WEBHOOK-SUCCESS: Subscription created for user:", userEmail);
  } catch (error) {
    console.error("SERVER: WEBHOOK-ERROR: Error handling subscription created:", error);
  }
}
