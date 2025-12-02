import type { Invoice } from "@/app/api/_lib/services/stripeService/subscriptionService";
import type { Subscription } from "../../stores";

/**
 * Fetch subscription data from the API
 */
export async function fetchSubscriptionData(): Promise<Subscription> {
  const response = await fetch("/api/stripe/subscriptions/read", {
    cache: "no-cache", // Disable caching to ensure fresh data
  });

  if (!response.ok) {
    throw new Error(
      "Failed to fetch subscription data: " +
        response.statusText +
        " " +
        response.status +
        " " +
        (await response.text()),
    );
  }

  const data = await response.json();
  return data;
}

/**
 * Fetch billing history from the API
 */
export async function fetchBillingHistory(): Promise<Invoice[]> {
  const response = await fetch("/api/stripe/subscriptions/history", {
    cache: "no-cache", // Disable caching to ensure fresh data
  });

  if (!response.ok) {
    throw new Error(
      "Failed to fetch billing history: " + response.statusText + " " + response.status + " " + (await response.text()),
    );
  }

  const data = await response.json();
  return data.invoices || data; // Handle both { invoices, hasMore } and direct array responses
}
