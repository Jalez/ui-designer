import type Stripe from "stripe";
import { getCreditService } from "../../creditService";
import { getPlanService } from "../../planService";
import { ensureUserInitializedByEmail } from "../../userService";
import { getMonthlyCredits, getPlanName, getStripeInstance } from "../shared";
import { updateUserSubscription } from "../subscriptionService";

export async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const stripe = getStripeInstance();
  console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Processing successful payment:", invoice.id);

  if (!invoice.customer) {
    console.error("SERVER: WEBHOOK-ERROR: No customer ID in invoice");
    return;
  }

  try {
    // Get customer details
    const customer = await stripe.customers.retrieve(invoice.customer as string);
    if (customer.deleted || !("email" in customer) || !customer.email) {
      console.error("SERVER: WEBHOOK-ERROR: Customer not found or no email");
      return;
    }

    const userEmail = customer.email;

    // Guarantee baseline credit records exist before applying payment effects
    const userId = await ensureUserInitializedByEmail(userEmail);

    const planService = getPlanService();
    const creditService = getCreditService();

    // Check if this payment should trigger special handling
    let shouldSkipCreditRefresh = false;
    let shouldApplyDelayedDowngrade = false;
    let shouldApplyUpgrade = false;
    let upgradePlanInfo: {
      planName: string;
      monthlyCredits: number;
      priceId: string;
      previousCredits: number;
    } | null = null;
    let downgradePlanInfo: { planName: string; monthlyCredits: number; priceId: string } | null = null;
    let metadata: Record<string, any> = {};

    // Define proper type for expanded invoice
    type ExpandedInvoice = Stripe.Invoice & {
      subscription?: Stripe.Subscription | null;
      lines?: {
        data: Array<
          Stripe.InvoiceLineItem & {
            price?: Stripe.Price | null;
            plan?: Stripe.Plan | null;
          }
        >;
      };
    };

    console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Invoice billing_reason:", invoice.billing_reason);

    // Try to get subscription ID from invoice - handle both regular and expanded invoices
    let subscriptionId = (invoice as ExpandedInvoice).subscription?.id || null;
    let invoiceToUse: ExpandedInvoice = invoice as ExpandedInvoice;

    if (!subscriptionId) {
      try {
        // Retrieve the full invoice with subscription and line items expanded to get subscription info
        const expandedInvoice = (await stripe.invoices.retrieve(invoice.id, {
          expand: ["subscription", "lines.data.price"],
        })) as ExpandedInvoice;
        subscriptionId = expandedInvoice.subscription?.id || null;
        invoiceToUse = expandedInvoice; // Use the expanded invoice for all subsequent operations
        console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Retrieved full invoice, subscription:", subscriptionId);
      } catch (error) {
        console.warn("SERVER: WEBHOOK-WARNING: Could not retrieve full invoice:", error);
      }
    }

    if (subscriptionId) {
      try {
        // Get the subscription
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        metadata = subscription.metadata as Record<string, string>;
        console.log("SERVER: WEBHOOK-PAYMENT-METADATA: Subscription metadata:", JSON.stringify(metadata));

        const priceId = subscription.items.data[0]?.price.id;
        const newCredits = priceId ? await getMonthlyCredits(priceId, planService, stripe) : null;

        // Check for plan changes (upgrade or immediate downgrade)
        const isPlanChange = metadata.isPlanChange === "true";
        console.log(
          "SERVER: WEBHOOK-PAYMENT-PLAN-CHANGE: isPlanChange:",
          isPlanChange,
          "billing_reason:",
          invoice.billing_reason,
        );

        // Check if this subscription is part of a schedule (deferred changes)
        const hasActiveSchedule = subscription.schedule !== null;
        console.log("SERVER: WEBHOOK-PAYMENT-SCHEDULE: hasActiveSchedule:", hasActiveSchedule);

        if (isPlanChange && newCredits && !hasActiveSchedule) {
          const previousCredits = metadata.previousMonthlyCredits ? Number(metadata.previousMonthlyCredits) : null;
          console.log(
            "SERVER: WEBHOOK-PAYMENT-CREDITS: previous:",
            previousCredits,
            "new:",
            newCredits,
            "priceId:",
            priceId,
          );

          if (previousCredits && previousCredits < newCredits) {
            // This is an upgrade - apply it immediately
            const planName = await getPlanName(priceId, stripe);

            shouldApplyUpgrade = true;
            shouldSkipCreditRefresh = true; // Don't do regular credit refresh for upgrades
            upgradePlanInfo = { planName, monthlyCredits: newCredits, priceId, previousCredits };
            console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Applying immediate upgrade");
          } else if (previousCredits && previousCredits > newCredits) {
            // This is an immediate downgrade - apply it immediately
            const planName = await getPlanName(priceId, stripe);

            shouldApplyDelayedDowngrade = true;
            shouldSkipCreditRefresh = true; // Don't do regular credit refresh for downgrades
            downgradePlanInfo = { planName, monthlyCredits: newCredits, priceId };
            console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Applying immediate downgrade");
          }
        } else if (isPlanChange && hasActiveSchedule) {
          console.log(
            "SERVER: WEBHOOK-PAYMENT-SCHEDULE: Skipping immediate plan change application - subscription has active schedule",
          );
        }

        // Check for delayed downgrade (subscription_cycle with downgrade metadata)
        if (invoice.billing_reason === "subscription_cycle") {
          const isPlanChange = metadata.isPlanChange === "true";
          console.log("SERVER: WEBHOOK-PAYMENT-PLAN-CHANGE: isPlanChange:", isPlanChange);

          if (isPlanChange) {
            const previousCredits = metadata.previousMonthlyCredits ? Number(metadata.previousMonthlyCredits) : null;
            console.log(
              "SERVER: WEBHOOK-PAYMENT-CREDITS: previous:",
              previousCredits,
              "new:",
              newCredits,
              "priceId:",
              priceId,
            );

            if (previousCredits && newCredits && previousCredits > newCredits) {
              // This is a delayed downgrade - apply it now
              const planName = await getPlanName(priceId, stripe);

              shouldApplyDelayedDowngrade = true;
              downgradePlanInfo = { planName, monthlyCredits: newCredits, priceId };
              console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Applying delayed downgrade for subscription cycle");
            }
          }
        }

        // Check for subscription schedule releases (downgrades that were deferred)
        if (invoice.billing_reason === "subscription_cycle") {
          // Check if this subscription was created from a schedule (indicating a deferred downgrade)
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          if (subscription.schedule) {
            console.log(
              "SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Subscription was created from schedule, checking for deferred downgrade",
            );

            // Get the schedule metadata
            const schedule = await stripe.subscriptionSchedules.retrieve(subscription.schedule as string);
            const scheduleMetadata = schedule.metadata || {};

            if (scheduleMetadata.isDowngrade === "true") {
              console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: This is a deferred downgrade from subscription schedule");

              // Get new plan details
              const newPriceId = subscription.items.data[0].price.id;
              const newCredits = await getMonthlyCredits(newPriceId, planService, stripe);
              const planName = await getPlanName(newPriceId, stripe);

              // Apply the downgrade now
              shouldApplyDelayedDowngrade = true;
              downgradePlanInfo = { planName, monthlyCredits: newCredits, priceId: newPriceId };
              console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Applying deferred downgrade from subscription schedule");
            }
          }
        }
      } catch (error) {
        console.warn("SERVER: WEBHOOK-WARNING: Could not check payment details:", error);
      }
    }

    // Apply upgrade if needed
    if (shouldApplyUpgrade && upgradePlanInfo) {
      console.log("SERVER: WEBHOOK-UPGRADE: Applying immediate upgrade - updating plan and setting credits");
      await updateUserSubscription(userEmail, {
        planName: upgradePlanInfo.planName,
        monthlyCredits: upgradePlanInfo.monthlyCredits,
        stripeMonthlyPriceId: upgradePlanInfo.priceId,
      });

      // Set credits to new plan amount immediately
      await creditService.setCredits({
        userId: userId,
        credits: upgradePlanInfo.monthlyCredits,
        metadata: {
          reason: "Immediate upgrade - credits set to new plan amount",
          stripeMonthlyPriceId: upgradePlanInfo.priceId,
          monthlyCredits: upgradePlanInfo.monthlyCredits,
          previousCredits: upgradePlanInfo.previousCredits,
          isUpgrade: true,
          webhookProcessed: true,
          previousPlanName: metadata.previousPlanName,
        },
      });
      console.log(
        `SERVER: WEBHOOK-SUCCESS: Immediate upgrade applied, credits set to ${upgradePlanInfo.monthlyCredits}`,
      );
    }
    // Apply delayed downgrade if needed
    else if (shouldApplyDelayedDowngrade && downgradePlanInfo) {
      console.log("SERVER: WEBHOOK-DOWNGRADE: Applying delayed downgrade - updating plan and resetting credits");
      await updateUserSubscription(userEmail, {
        planName: downgradePlanInfo.planName,
        monthlyCredits: downgradePlanInfo.monthlyCredits,
      });

      // Reset credits to new plan amount
      await creditService.setCredits({
        userId: userId,
        credits: downgradePlanInfo.monthlyCredits,
        metadata: {
          reason: "Delayed downgrade - credits reset to new plan amount at billing cycle",
          stripeMonthlyPriceId: downgradePlanInfo.priceId,
          monthlyCredits: downgradePlanInfo.monthlyCredits,
          isDowngrade: true,
          webhookProcessed: true,
        },
      });
      console.log(
        `SERVER: WEBHOOK-SUCCESS: Delayed downgrade applied, credits reset to ${downgradePlanInfo.monthlyCredits}`,
      );
    } else if (!shouldSkipCreditRefresh) {
      // Normal credit refresh for regular billing cycles
      console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Refreshing credits for new billing period");
      await creditService.refreshUserCredits({ userId: userId });
    } else {
      console.log("SERVER: WEBHOOK-PAYMENT-SUCCEEDED: Skipping credit refresh (upgrade/downgrade handled)");
    }

    console.log("SERVER: WEBHOOK-SUCCESS: Payment succeeded for user:", userEmail);
  } catch (error) {
    console.error("SERVER: WEBHOOK-ERROR: Error handling payment succeeded:", error);
  }
}
