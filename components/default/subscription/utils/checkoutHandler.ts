import type { CheckoutSessionResult } from "../service/subscription/create";

/**
 * Handle the checkout session response and perform redirects
 */
export function handleCheckoutResponse(data: CheckoutSessionResult): void {
  // Handle different response types
  if (data.checkoutUrl) {
    // Redirect to Stripe checkout for plan change
    console.log("Redirecting to Stripe checkout for plan change");
    window.location.href = data.checkoutUrl;
  } else if (data.isPortal) {
    console.log("Redirecting to billing portal for plan change");

    // Store timestamp when portal was opened for tracking
    if (data.portalOpenedAt) {
      localStorage.setItem("billing_portal_opened_at", data.portalOpenedAt.toString());
    }

    // Redirect to the portal
    if (data.url) {
      window.location.href = data.url;
    }
  } else if (data.url) {
    console.log("Redirecting to checkout session for new subscription");
    // Redirect to checkout
    window.location.href = data.url;
  } else {
    // Handle error responses
    throw new Error(data.error || data.details || "Unknown error");
  }
}
