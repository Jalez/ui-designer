import type Stripe from "stripe";
import { getStripeInstance } from "../shared";
import { handleSubscriptionCreated } from "./create";
import { handleSubscriptionDeleted } from "./delete";
import { handlePaymentFailed } from "./payment-failed";
import { handlePaymentSucceeded } from "./payment-success";
import { handleSubscriptionUpdated } from "./update";

const stripe = getStripeInstance();

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  console.log("SERVER: WEBHOOK-RECEIVED: Processing event:", event.type);

  switch (event.type) {
    case "customer.subscription.created":
      await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      break;

    case "invoice_payment.paid": {
      // For invoice_payment.paid events, we need to fetch the actual invoice
      const invoicePayment = event.data.object as Stripe.InvoicePayment;
      const invoice = await stripe.invoices.retrieve(invoicePayment.invoice as string);
      await handlePaymentSucceeded(invoice);
      break;
    }

    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;

    default:
      console.log("SERVER: WEBHOOK-UNHANDLED: Unhandled event type:", event.type);
  }
}
