/**
 * Credit Calculation System
 *
 * Core Concept:
 * - Users pay for credits upfront
 * - Each API call costs credits based on actual provider pricing
 * - We maintain a 20% profit margin by marking up costs
 *
 * Example:
 * - User subscribes to Starter plan: $10/month = 1,000,000 credits
 * - 1 credit = $0.00001 (or $10 per 1M credits)
 * - Actual API cost gets marked up by 25% (to achieve 20% profit margin)
 * - If API call costs $0.000008, user pays: $0.000008 * 1.25 = $0.00001 = 1 credit
 */

// Types
export interface ModelPricing {
  prompt: string;
  completion: string;
  request: string;
  image: string;
  internal_reasoning: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  pricing: ModelPricing;
}

// Configuration
export const CREDIT_CONFIG = {
  // Base credit value: 1 credit = this many dollars
  // Setting this to 0.00001 means 100,000 credits = $1
  CREDIT_VALUE_IN_DOLLARS: 0.00001,

  // Profit margin: 20% profit means we charge 125% of cost (cost / 0.8 = cost * 1.25)
  // If something costs us $0.80, we charge $1.00, making $0.20 profit (20% of revenue)
  MARKUP_MULTIPLIER: 1.25, // 25% markup = 20% profit margin

  // Minimum credit charge (to avoid zero-cost operations)
  MIN_CREDIT_COST: 1,
} as const;

/**
 * Converts dollars to credits
 * @param dollars - The dollar amount
 * @returns Number of credits (rounded up to nearest integer)
 */
export function dollarsToCredits(dollars: number): number {
  if (dollars <= 0) return CREDIT_CONFIG.MIN_CREDIT_COST;

  const credits = Math.ceil(dollars / CREDIT_CONFIG.CREDIT_VALUE_IN_DOLLARS);
  return Math.max(credits, CREDIT_CONFIG.MIN_CREDIT_COST);
}

/**
 * Converts credits to dollars
 * @param credits - Number of credits
 * @returns Dollar amount
 */
export function creditsToDollars(credits: number): number {
  return credits * CREDIT_CONFIG.CREDIT_VALUE_IN_DOLLARS;
}

/**
 * Calculates credit cost for a text completion API call
 * @param promptTokens - Number of prompt tokens
 * @param completionTokens - Number of completion tokens
 * @param promptPricePerToken - Price per prompt token (from model pricing)
 * @param completionPricePerToken - Price per completion token (from model pricing)
 * @returns Credit cost for the operation
 */
export function calculateTextCompletionCredits(
  promptTokens: number,
  completionTokens: number,
  promptPricePerToken: string,
  completionPricePerToken: string,
): number {
  const promptPrice = parseFloat(promptPricePerToken) || 0;
  const completionPrice = parseFloat(completionPricePerToken) || 0;

  // Calculate actual API cost
  const promptCost = promptTokens * promptPrice;
  const completionCost = completionTokens * completionPrice;
  const totalApiCost = promptCost + completionCost;

  // Apply markup for profit margin
  const chargeAmount = totalApiCost * CREDIT_CONFIG.MARKUP_MULTIPLIER;

  // Convert to credits
  return dollarsToCredits(chargeAmount);
}

/**
 * Calculates credit cost for an image generation API call
 * @param imageCount - Number of images generated
 * @param imagePricePerImage - Price per image (from model pricing)
 * @returns Credit cost for the operation
 */
export function calculateImageGenerationCredits(imageCount: number, imagePricePerImage: string): number {
  const imagePrice = parseFloat(imagePricePerImage) || 0;

  // Calculate actual API cost
  const totalApiCost = imageCount * imagePrice;

  // Apply markup for profit margin
  const chargeAmount = totalApiCost * CREDIT_CONFIG.MARKUP_MULTIPLIER;

  // Convert to credits
  return dollarsToCredits(chargeAmount);
}

/**
 * Calculates credit cost for a request-based API call
 * @param requestCount - Number of requests
 * @param requestPricePerRequest - Price per request (from model pricing)
 * @returns Credit cost for the operation
 */
export function calculateRequestBasedCredits(requestCount: number, requestPricePerRequest: string): number {
  const requestPrice = parseFloat(requestPricePerRequest) || 0;

  // Calculate actual API cost
  const totalApiCost = requestCount * requestPrice;

  // Apply markup for profit margin
  const chargeAmount = totalApiCost * CREDIT_CONFIG.MARKUP_MULTIPLIER;

  // Convert to credits
  return dollarsToCredits(chargeAmount);
}

/**
 * Calculates credit cost for reasoning tokens
 * @param reasoningTokens - Number of reasoning tokens used
 * @param reasoningPricePerToken - Price per reasoning token (from model pricing)
 * @returns Credit cost for the operation
 */
export function calculateReasoningCredits(reasoningTokens: number, reasoningPricePerToken: string): number {
  const reasoningPrice = parseFloat(reasoningPricePerToken) || 0;

  // Calculate actual API cost
  const totalApiCost = reasoningTokens * reasoningPrice;

  // Apply markup for profit margin
  const chargeAmount = totalApiCost * CREDIT_CONFIG.MARKUP_MULTIPLIER;

  // Convert to credits
  return dollarsToCredits(chargeAmount);
}

/**
 * Estimates credit cost before making an API call
 * Useful for showing users estimated cost before they proceed
 * @param estimatedPromptTokens - Estimated prompt tokens
 * @param estimatedCompletionTokens - Estimated completion tokens
 * @param modelPricing - Model pricing object
 * @returns Estimated credit cost
 */
export function estimateCreditsForCall(
  estimatedPromptTokens: number,
  estimatedCompletionTokens: number,
  modelPricing: {
    prompt: string;
    completion: string;
  },
): number {
  return calculateTextCompletionCredits(
    estimatedPromptTokens,
    estimatedCompletionTokens,
    modelPricing.prompt,
    modelPricing.completion,
  );
}

/**
 * Formats credits for display
 * @param credits - Number of credits
 * @returns Formatted string
 */
export function formatCredits(credits: number): string {
  const roundedCredits = Math.round(credits);

  if (roundedCredits >= 1_000_000_000_000) {
    const trillions = Math.round(roundedCredits / 1_000_000_000_000);
    return trillions >= 1000 ? "∞" : `${trillions}T`;
  }
  if (roundedCredits >= 1_000_000_000) {
    return `${Math.round(roundedCredits / 1_000_000_000)}B`;
  }
  if (roundedCredits >= 1_000_000) {
    return `${Math.round(roundedCredits / 1_000_000)}M`;
  }
  if (roundedCredits >= 1_000) {
    return `${Math.round(roundedCredits / 1_000)}K`;
  }
  return roundedCredits.toLocaleString();
}

/**
 * Calculate credits for a model (1M tokens for text, 1 image for image models)
 * This provides consistent pricing across the app
 * @param model - Model object with pricing
 * @returns Credit cost for standard usage
 */
export function calculateModelCredits(model: { pricing?: { prompt?: string; completion?: string; image?: string } }): number {
  if (!model.pricing) return 0;

  // Check if it's an image model (has image pricing)
  if (model.pricing.image && parseFloat(model.pricing.image) > 0) {
    return calculateImageGenerationCredits(1, model.pricing.image);
  }

  // Text model - use both prompt and completion pricing
  return calculateTextCompletionCredits(
    500000, // 500K prompt tokens
    500000, // 500K completion tokens
    model.pricing.prompt || "0",
    model.pricing.completion || "0"
  );
}

/**
 * Formats dollar amount for display
 * @param dollars - Dollar amount
 * @returns Formatted string
 */
export function formatDollars(dollars: number): string {
  if (dollars < 0.01) {
    return `$${dollars.toFixed(6)}`;
  }
  return `$${dollars.toFixed(2)}`;
}
