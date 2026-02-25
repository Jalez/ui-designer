import { Stripe } from "stripe";
import { getCreditService } from "../creditService";

// Lazy initialization of Stripe client to avoid build-time errors
let stripeInstance: Stripe | null = null;

export function getStripeInstance(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }

    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil",
    });
  }
  return stripeInstance;
}

// Helper function to get plan name from Stripe price ID
export async function getPlanFromPriceId(priceId: string): Promise<string | null> {
  const stripe = getStripeInstance();
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const product = price.product;
    if (product && typeof product === "object" && "name" in product && product.name) {
      return product.name;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching plan name for price ${priceId}:`, error);
    return null;
  }
}

// Helper function to parse credits from string format (e.g., "20,000,000" or "1K", "1.5M")
export function parseCreditsFromString(creditsStr: string): number {
  if (!creditsStr || typeof creditsStr !== "string") {
    return 0;
  }

  // Remove commas first
  const cleaned = creditsStr.replace(/,/g, "");

  // Check for K/M suffixes
  const match = cleaned.match(/^([\d,]+(?:\.\d+)?)\s*([KM]?)$/i);
  if (match) {
    const [, numberStr, suffix] = match;
    const number = parseFloat(numberStr);

    if (suffix.toUpperCase() === "K") return Math.floor(number * 1000);
    if (suffix.toUpperCase() === "M") return Math.floor(number * 1000000);
    return Math.floor(number);
  }

  // Fallback to simple parsing
  const parsed = parseInt(cleaned, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// Get plan features from Stripe product metadata
export async function getPlanFeatures(stripeMonthlyPriceId: string, stripe: Stripe): Promise<string[]> {
  try {
    const price = await stripe.prices.retrieve(stripeMonthlyPriceId, { expand: ["product"] });
    const product = price.product;

    if (product && typeof product === "object" && "metadata" in product && product.metadata) {
      const features: string[] = [];

      // Add any marketing features from the product (these are pre-defined by Stripe)
      if (product.marketing_features && Array.isArray(product.marketing_features)) {
        product.marketing_features.forEach((feature: any) => {
          if (feature.name) {
            features.push(feature.name);
          }
        });
      }

      return features;
    }

    // Return empty array - features are constructed by frontend based on raw data
    return [];
  } catch (error) {
    console.error(`Error fetching features for ${stripeMonthlyPriceId}:`, error);
    return [];
  }
}

// Get plan name from Stripe product
export async function getPlanName(stripeMonthlyPriceId: string, stripe: Stripe): Promise<string> {
  try {
    const price = await stripe.prices.retrieve(stripeMonthlyPriceId, { expand: ["product"] });
    const product = price.product;
    if (product && typeof product === "object" && "name" in product && product.name) {
      return product.name;
    }
    return "Plan";
  } catch (error) {
    console.error(`Error fetching name for ${stripeMonthlyPriceId}:`, error);
    return "Plan";
  }
}

// Get free plan details from Stripe
export async function getFreePlanFromStripe(): Promise<{ planName: string; monthlyCredits: number }> {
  const stripe = getStripeInstance();

  try {
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
    });

    const freePrice = prices.data.find((price) => price.unit_amount === 0);
    if (!freePrice) {
      throw new Error("No free plan found in Stripe. Please create a free plan (price = 0) in Stripe dashboard.");
    }

    const product = freePrice.product as any;
    const monthlyCredits = product?.metadata?.credits ? Number(product.metadata.credits) : 50;

    return {
      planName: product?.name || "Free Plan",
      monthlyCredits,
    };
  } catch (error) {
    console.error("Error fetching free plan from Stripe:", error);
    throw error;
  }
}

// Get monthly credits from Stripe metadata
export async function getMonthlyCredits(
  stripeMonthlyPriceId: string,
  planService: any, // No longer used, kept for backward compatibility
  stripe: Stripe,
  priceId?: string,
): Promise<number> {
  // Get credits from Stripe product metadata
  if (priceId) {
    try {
      const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
      if (price.product && typeof price.product === "object" && "metadata" in price.product) {
        const product = price.product;
        if (product.metadata?.credits) {
          const stripeCredits = parseCreditsFromString(product.metadata.credits);
          if (stripeCredits > 0) {
            return stripeCredits;
          }
        }
      }
    } catch (error) {
      console.warn(`Error fetching credits from Stripe metadata for ${stripeMonthlyPriceId}:`, error);
    }
  }

  // No fallback to database - Stripe is single source of truth
  console.warn(`No credits found in Stripe metadata for ${stripeMonthlyPriceId}`);
  return 0;
}
