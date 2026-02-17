import type Stripe from "stripe";
import { getStripeInstance } from "../shared";

export async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const stripe = getStripeInstance();
  console.log("SERVER: WEBHOOK-PAYMENT-FAILED: Processing failed payment:", invoice.id);

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
    console.log("SERVER: WEBHOOK-INFO: Payment failed for user:", userEmail);

    // You might want to implement additional logic here, such as:
    // - Sending notification emails
    // - Updating subscription status
    // - Implementing grace periods
  } catch (error) {
    console.error("SERVER: WEBHOOK-ERROR: Error handling payment failed:", error);
  }
}
