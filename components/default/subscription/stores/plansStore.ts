import { create } from "zustand";

// Session storage keys
const PRICING_PLANS_STORAGE_KEY = "scriba_pricing_plans";
// Plan configurations removed - plans are now managed in Stripe only
const PLANS_TIMESTAMP_KEY = "scriba_plans_timestamp";

// Session storage duration (24 hours in milliseconds)
const SESSION_STORAGE_DURATION = 24 * 60 * 60 * 1000;

// Helper functions for session storage
function savePricingPlansToSession(pricingPlans: PricingPlan[]): void {
  try {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(PRICING_PLANS_STORAGE_KEY, JSON.stringify(pricingPlans));
      sessionStorage.setItem(PLANS_TIMESTAMP_KEY, Date.now().toString());
    }
  } catch (error) {
    console.warn("Failed to save pricing plans to session storage:", error);
  }
}

function loadPricingPlansFromSession(): PricingPlan[] | null {
  try {
    if (typeof window !== "undefined") {
      const timestamp = sessionStorage.getItem(PLANS_TIMESTAMP_KEY);
      const plansData = sessionStorage.getItem(PRICING_PLANS_STORAGE_KEY);

      if (timestamp && plansData) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age < SESSION_STORAGE_DURATION) {
          return JSON.parse(plansData);
        } else {
          // Data is too old, clear it
          sessionStorage.removeItem(PRICING_PLANS_STORAGE_KEY);
          sessionStorage.removeItem(PLANS_TIMESTAMP_KEY);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to load pricing plans from session storage:", error);
  }
  return null;
}

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

    // Check if we have valid data from session storage
    const sessionPlans = loadPricingPlansFromSession();
    if (sessionPlans && sessionPlans.length > 0) {
      set({ pricingPlans: sessionPlans });
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

      // Save to session storage
      savePricingPlansToSession(processedPlans);
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
    set({
      pricingPlans: [],
      isLoadingPlans: false,
      plansError: null,
      lastFetchTime: 0,
    });
  },
}));
