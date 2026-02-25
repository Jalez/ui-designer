// Re-export types from types file
export * from "./types";

// Re-export all CRUD operations
export * from "./create";
export * from "./delete";
export * from "./read";
export * from "./update";

// Re-export validation utilities (replaces middleware)
import { parseCreditsFromString } from "../stripeService/shared";
export * from "./validation";
export * from "./config";

// Re-export individual functions for backward compatibility
export { getTransactions } from "./read";
export { getUserCredits } from "./read";
export { hasEnoughCredits } from "./read";
export { getCreditHistory } from "./read";
export { getAllServiceCosts } from "./read";
export { deductCredits } from "./update";
export { adminUpdateCredits } from "./update";
export { setCredits } from "./create";
export { addCredits } from "./create";
export { refreshUserCredits } from "./update";
export { resetMonthlyCredits } from "./update";
export { getServiceCategory } from "./shared";

import { calculateModelBasedCost } from "../modelService/utils/utils";
import { getMonthlyCredits } from "../stripeService";
import { getServiceCategory as getServiceCategoryFn } from "./shared";
import * as read from "./read";
import * as update from "./update";
import * as create from "./create";

/**
 * Calculate total cost for a service usage using model-based pricing
 */
export function calculateServiceCost(params: any) {
  // If model info is provided, use model-based pricing
  if (params.modelInfo) {
    return calculateModelBasedCost(params);
  }

  // Fallback to legacy service-based calculation for backward compatibility
  console.warn("SERVER: DEPRECATED-CALC: Using legacy service cost calculation for", params.serviceName);
  throw new Error("Service costs functionality has been deprecated and replaced by model-based pricing");
}

/**
 * Get monthly credits for a price ID
 */
export async function getMonthlyCreditsFromPriceId(priceId: string) {
  // Import Stripe and create instance locally to avoid Turbopack issues
  const { default: Stripe } = await import("stripe");
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY environment variable is not set");
  }
  const stripe = new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });

  // Since we're using Stripe as single source of truth, get credits directly from Stripe metadata
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    if (price.product && typeof price.product === "object" && "metadata" in price.product) {
      const product = price.product;
      if (product.metadata?.credits) {
        const credits = parseCreditsFromString(product.metadata.credits);
        if (credits > 0) {
          return credits;
        }
      }
    }
    // Fallback to default if not found in Stripe
    return 0;
  } catch (error) {
    console.error(`Error fetching credits from Stripe for price ${priceId}:`, error);
    return 0;
  }
}

// Export a simple accessor function for consistency with other services
export const getCreditService = () => ({
  getTransactions: read.getTransactions,
  getServiceCategory: getServiceCategoryFn,
  getUserCredits: read.getUserCredits,
  getMonthlyCreditsFromPriceId: getMonthlyCreditsFromPriceId,
  calculateServiceCost: calculateServiceCost,
  hasEnoughCredits: read.hasEnoughCredits,
  deductCredits: update.deductCredits,
  adminUpdateCredits: update.adminUpdateCredits,
  setCredits: create.setCredits,
  addCredits: create.addCredits,
  refreshUserCredits: update.refreshUserCredits,
  resetMonthlyCredits: update.resetMonthlyCredits,
  getCreditHistory: read.getCreditHistory,
  getAllServiceCosts: read.getAllServiceCosts,
});
