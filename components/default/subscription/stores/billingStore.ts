import { create } from "zustand";
import type { Invoice } from "@/app/api/_lib/services/stripeService/subscriptionService";

interface BillingStore {
  // Data
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number;
  hasFetched: boolean;

  // Actions
  fetchInvoices: () => Promise<void>;
  setInvoices: (invoices: Invoice[]) => void;
  setError: (error: string | null) => void;
  clearInvoices: () => void;
  refetch: () => Promise<void>;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for billing history (less frequent updates needed)

export const useBillingStore = create<BillingStore>((set, get) => ({
  // Initial state
  invoices: [],
  isLoading: false,
  error: null,
  lastFetchTime: 0,
  hasFetched: false,

  fetchInvoices: async () => {
    const state = get();

    // Prevent fetching too frequently
    const now = Date.now();
    if (now - state.lastFetchTime < CACHE_DURATION && state.hasFetched) {
      return;
    }

    // Prevent duplicate concurrent fetches
    if (state.isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch("/api/stripe/subscriptions/history", {
        cache: "no-cache", // Ensure fresh data for billing history
      });

      if (!response.ok) {
        throw new Error("Failed to fetch billing history");
      }

      const data = await response.json();
      const invoices = data.invoices || data; // Handle both { invoices, hasMore } and direct array responses

      set({
        invoices,
        isLoading: false,
        lastFetchTime: now,
        hasFetched: true,
        error: null,
      });
    } catch (error) {
      console.error("Error fetching billing history:", error);

      set({
        invoices: [],
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown error",
        lastFetchTime: now,
        hasFetched: true,
      });
    }
  },

  setInvoices: (invoices: Invoice[]) => {
    set({ invoices });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearInvoices: () => {
    set({
      invoices: [],
      isLoading: false,
      error: null,
      lastFetchTime: 0,
      hasFetched: false,
    });
  },

  refetch: async () => {
    set({ hasFetched: false }); // Force refetch
    await get().fetchInvoices();
  },
}));
