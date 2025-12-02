import { getStripeInstance } from "./shared";

// Lazy initialization of Stripe client to avoid build-time errors

export interface PortalSessionConfig {
  customerId: string;
  returnUrl: string;
}

export interface PortalSessionResult {
  url: string;
}

export async function createPortalSession(config: PortalSessionConfig): Promise<PortalSessionResult> {
  const { customerId, returnUrl } = config;
  const stripe = getStripeInstance();

  // Create the portal session with the real customer ID
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return {
    url: portalSession.url,
  };
}
