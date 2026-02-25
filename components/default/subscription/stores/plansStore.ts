import { create } from "zustand";

let memoryPlansCache: PricingPlan[] | null = null;

// Plan configuration functions removed - plans are now managed in Stripe only

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode | null;
  color: string;
  stripeProductId?: string;
  stripeMonthlyPriceId?: string;
  stripeYearlyPriceId?: string;
  currentPlan?: boolean;
  // Database fields removed - plans are now managed in Stripe only
}

interface PlansStore {
  // Data
  pricingPlans: PricingPlan[];
  isLoadingPlans: boolean;
  plansError: string | null;
  lastFetchTime: number;

  // Actions
  fetchPricingPlans: () => Promise<void>;
  fetchAllPlans: () => Promise<void>;
  setPlansError: (error: string | null) => void;
  clearPlans: () => void;
  // Plan configurations removed - plans are now managed in Stripe only
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const usePlansStore = create<PlansStore>((set, get) => ({
  // Initial state - start empty to avoid hydration mismatches
  pricingPlans: [],
  isLoadingPlans: false,
  plansError: null,
  lastFetchTime: 0,

  fetchPricingPlans: async () => {
    const state = get();

    // Check if we have valid data from memory cache
    if (memoryPlansCache && memoryPlansCache.length > 0) {
      set({ pricingPlans: memoryPlansCache });
      return;
    }

    // Prevent fetching too frequently (fallback to original cache logic)
    const now = Date.now();
    if (now - state.lastFetchTime < CACHE_DURATION && state.pricingPlans.length > 0) {
      return;
    }

    // Prevent duplicate concurrent fetches
    if (state.isLoadingPlans) {
      return;
    }

    set({ isLoadingPlans: true, plansError: null });

    try {
      const response = await fetch("/api/stripe/plans/read");
      if (!response.ok) {
        throw new Error("Failed to fetch plans");
      }

      const data = await response.json();

      // Handle both old format (array) and new format ({ plans, isAdmin })
      const plans = Array.isArray(data) ? data : data.plans || [];

      // Process plans (database fields removed - plans are now managed in Stripe only)
      const processedPlans = plans
        .filter((plan) => plan != null); // Filter out null/undefined plans
      set({
        pricingPlans: processedPlans,
        isLoadingPlans: false,
        lastFetchTime: now,
      });

      memoryPlansCache = processedPlans;
    } catch (error) {
      console.error("Error fetching pricing plans:", error);
      set({
        isLoadingPlans: false,
        plansError: error instanceof Error ? error.message : "Failed to load plans",
      });
    }
  },

  fetchAllPlans: async () => {
    await get().fetchPricingPlans();
  },

  setPlansError: (error: string | null) => {
    set({ plansError: error });
  },

  clearPlans: () => {
    memoryPlansCache = null;
    set({
      pricingPlans: [],
      isLoadingPlans: false,
      plansError: null,
      lastFetchTime: 0,
    });
  },
}));
