import { getStripeInstance, parseCreditsFromString } from "./shared";


/**
 * Get all active plans from Stripe only (no database cross-referencing)
 */
export async function getStripePlans(): Promise<StripePlanData[]> {
  const stripe = getStripeInstance();

  // Fetch all products with their default prices
  const products = await stripe.products.list({
    active: true,
    expand: ["data.default_price"],
  });

  // Fetch all prices to get detailed price information (fallback)
  const prices = await stripe.prices.list({
    active: true,
    expand: ["data.product"],
  });


  const plans = products.data
    .map((product) => {
      // Find all prices for this product (monthly and yearly)
      const productPrices = prices.data.filter((p) =>
        typeof p.product === "object" ? p.product.id === product.id : p.product === product.id,
      );

      // Also check if there's a default_price on the product
      let monthlyPrice = null;
      let yearlyPrice = null;

      // First, try to use the expanded default_price from the product
      if (product.default_price && typeof product.default_price === "object") {
        const defaultPrice = product.default_price;
        if (defaultPrice.recurring?.interval === "month") {
          monthlyPrice = defaultPrice;
        } else if (defaultPrice.recurring?.interval === "year") {
          yearlyPrice = defaultPrice;
        }
      }

      // Then check the prices array for any additional prices
      productPrices.forEach((price) => {
        if (price.recurring?.interval === "month" && !monthlyPrice) {
          monthlyPrice = price;
        } else if (price.recurring?.interval === "year" && !yearlyPrice) {
          yearlyPrice = price;
        }
      });

      // Use monthly as default for now, but we'll return both
      const defaultPrice = monthlyPrice || yearlyPrice;

      if (!defaultPrice) {
        console.warn(`No valid price found for product ${product.id} (${product.name})`);
        return null;
      }

      // Features are constructed by frontend based on raw data (monthlyCredits, etc.)
      const features: string[] = [];

      // Determine plan ID based on product name or metadata
      let planId = product.metadata?.plan_id;
      if (!planId) {
        planId = product.id; // fallback to product ID
      }

      // Extract raw credits for frontend formatting
      const rawCredits = product.metadata?.credits ? parseCreditsFromString(product.metadata.credits) : 0;

      const planData: StripePlanData = {
        id: planId,
        name: product.name,
        price: monthlyPrice?.unit_amount ? Math.round(monthlyPrice.unit_amount / 100) : 0, // Monthly price in dollars
        period: "month", // Always show monthly pricing, calculate yearly on frontend
        description: product.description || "",
        features,
        monthlyCredits: rawCredits, // Raw credit amount for frontend formatting
        popular: false,
        icon: null, // We'll handle icons on the frontend
        color: product.metadata?.color || "from-gray-700 to-gray-900",
        stripeProductId: product.id,
        stripeMonthlyPriceId: monthlyPrice?.id || "",
        stripeYearlyPriceId: yearlyPrice?.id || "",
      };

      return planData;
    })
    .filter(Boolean) as StripePlanData[]; // Remove null entries

  console.log(`Successfully processed ${plans.length} Stripe plans`);

  plans.sort((a, b) => (a?.price || 0) - (b?.price || 0));

  return plans;
}

export interface StripePlanData {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  monthlyCredits: number; // Raw credit amount for frontend formatting
  popular: boolean | null;
  icon: null;
  color: string;
  stripeProductId: string;
  stripeMonthlyPriceId: string;
  stripeYearlyPriceId: string;
}

export interface PlansResponse {
  plans: StripePlanData[];
  isAdmin: boolean;
}
