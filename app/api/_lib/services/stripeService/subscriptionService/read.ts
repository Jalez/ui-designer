import type Stripe from "stripe";
import { getPlanService } from "../../planService";
import { getMonthlyCredits, getPlanFeatures, getPlanName, getStripeInstance } from "../shared";
import { createFreeSubscription } from "./create";
import type { Invoice, Subscription } from "./types";

export async function getSubscriptionData(userEmail: string): Promise<Subscription> {
  try {
    const stripe = getStripeInstance();
    const planService = getPlanService();
    // Find customer by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });
    if (customers.data.length === 0) {
      // Create free subscription for new user (will create customer internally)
      return await createFreeSubscription(userEmail);
    }

    const customer = customers.data[0];

    // Get subscriptions - try active first, then all
    let subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 1,
      });
    }

    if (subscriptions.data.length === 0) {
      // Create free subscription for existing customer
      return await createFreeSubscription(userEmail, customer.id);
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;

    if (!priceId) {
      console.error("No price ID found on subscription - this indicates a data integrity issue");
      throw new Error("Invalid subscription: no price ID found");
    }

    // Get plan details
    const [features, planName, monthlyCredits] = await Promise.all([
      getPlanFeatures(priceId, stripe),
      getPlanName(priceId, stripe),
      getMonthlyCredits(priceId, planService, stripe, priceId),
    ]);

    // Check for pending plan changes
    let pendingPlanChange: Subscription["pendingPlanChange"];

    try {
      const schedules = await stripe.subscriptionSchedules.list({
        customer: customer.id,
      });

      if (schedules.data.length > 0) {
        const schedule = schedules.data[0];
        if (schedule.status === "active" && schedule.phases.length > 1) {
          const nextPhase = schedule.phases[1];
          const nextPriceId = nextPhase.items[0]?.price;

          if (nextPriceId) {
            const nextPriceIdStr = typeof nextPriceId === "string" ? nextPriceId : nextPriceId.id;
            const [nextPlanName, nextCredits] = await Promise.all([
              getPlanName(nextPriceIdStr, stripe),
              getMonthlyCredits(nextPriceIdStr, planService, stripe),
            ]);

            pendingPlanChange = {
              plan: nextPriceIdStr,
              planName: nextPlanName,
              effectiveDate: schedule.phases[0].end_date || 0,
              credits: nextCredits,
            };
          }
        }
      }
    } catch (error) {
      console.warn("Error checking for subscription schedules:", error);
    }

    return {
      stripeCustomerId: customer.id,
      plan: priceId,
      status: subscription.status as "active" | "canceled" | "past_due" | "incomplete",
      currentPeriodEnd: subscription.items.data[0]?.current_period_end || null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      features,
      planName,
      monthlyCredits,
      ...(pendingPlanChange && { pendingPlanChange }),
    };
  } catch (error) {
    console.error("Error fetching subscription data:", error);
    return {
      stripeCustomerId: "",
      plan: null,
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      features: ["Basic OCR", "Limited pages", "Standard support"],
      planName: "Error Loading Plan",
      monthlyCredits: Number.NaN,
    };
  }
}

export async function getBillingHistory(userEmail: string): Promise<Invoice[]> {
  try {
    const stripe = getStripeInstance();

    // Find the customer by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return [];
    }

    const customer = customers.data[0];

    // Get all invoices for this customer
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 50, // Get up to 50 recent invoices
    });

    // Transform the invoice data for the frontend
    const billingHistory = invoices.data.map((invoice: Stripe.Invoice) => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount: invoice.amount_due / 100, // Convert from cents
      currency: invoice.currency.toUpperCase(),
      date: invoice.created,
      description: invoice.description || `Invoice ${invoice.number}`,
      downloadUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      paid: invoice.status === "paid",
    }));

    // Sort by date (most recent first)
    billingHistory.sort((a, b) => b.date - a.date);

    return billingHistory;
  } catch (error) {
    console.error("Error fetching billing history:", error);
    return [];
  }
}
