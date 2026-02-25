import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { create } from "zustand";
import { fetchSubscriptionData, createCheckoutSession, getPriceId } from "../service/subscription";
import { cancelSubscription } from "../service/subscription/cancel";
import { handleCheckoutResponse } from "../utils/checkoutHandler";
import { executeAsync } from "../utils/executeAsync";

export interface Subscription {
  status: "active" | "canceled" | "past_due" | "incomplete";
  currentPeriodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  features: string[];
  planName?: string;
  monthlyCredits?: number;
  pendingPlanChange?: {
    planName: string;
    effectiveDate: number;
    credits: number;
  };
}

interface SubscriptionStore {
  // Data
  subscription: Subscription | null;
  isLoading: boolean;
  error: string | null;
  lastFetchTime: number;
  hasFetched: boolean;
  purchasing: boolean;
  managing: boolean;

  // Actions
  fetchSubscription: () => Promise<void>;
  setSubscription: (subscription: Subscription | null) => void;
  updateSubscriptionLocally: (updates: Partial<Subscription>) => void;
  cancelSubscription: () => Promise<void>;
  manageSubscription: () => Promise<void>;
  subscribe: (plan: any, isYearly?: boolean) => Promise<void>;
  setError: (error: string | null) => void;
  clearSubscription: () => void;
  refetch: () => Promise<void>;
}

const CACHE_DURATION = 60 * 1000; // 1 minute for subscription data (more frequent updates needed)

export const useSubscriptionStore = create<SubscriptionStore>()(
  (set, get) => ({
      // Initial state
      subscription: null,
      isLoading: false,
      error: null,
      lastFetchTime: 0,
      hasFetched: false,
      purchasing: false,
      managing: false,

      fetchSubscription: async () => {
        const state = get();

        // Prevent duplicate initial fetches - if already fetched, skip
        if (state.hasFetched) {
          return;
        }

        // Prevent fetching too frequently
        const now = Date.now();
        if (now - state.lastFetchTime < CACHE_DURATION) {
          return;
        }

        // Prevent duplicate concurrent fetches
        if (state.isLoading) {
          return;
        }

        set({ isLoading: true, error: null });

        try {
          const data = await fetchSubscriptionData();
          set({ subscription: data, isLoading: false, lastFetchTime: now, hasFetched: true, error: null });
        } catch (error) {
          console.error("Error fetching subscription:", error);
          set({
            subscription: null,
            isLoading: false,
            error: error instanceof Error ? error.message : "Unknown error",
            lastFetchTime: now,
            hasFetched: true,
          });
        }
      },

      setSubscription: (subscription: Subscription | null) => {
        set({ subscription });
      },

      updateSubscriptionLocally: (updates: Partial<Subscription>) => {
        set((state) => ({
          subscription: state.subscription ? { ...state.subscription, ...updates } : null,
        }));
      },

      cancelSubscription: async () => {
        try {
          await cancelSubscription();
        } catch (error) {
          console.error("Error canceling subscription:", error);
          throw error;
        }
      },

      manageSubscription: async () => {
        set({ managing: true });
        try {
          const response = await fetch("/api/stripe/portal", {
            method: "POST",
          });

          if (!response.ok) {
            throw new Error("Failed to create portal session");
          }

          const { url } = await response.json();
          window.location.href = url;
        } catch (error) {
          console.error("Error creating portal session:", error);
          throw error;
        } finally {
          set({ managing: false });
        }
      },

      subscribe: (plan: any, isYearly: boolean = false) =>
        executeAsync({
          asyncFn: async () => {
            const priceId = getPriceId(plan, isYearly);
            const data = await createCheckoutSession(priceId, plan.id);
            handleCheckoutResponse(data);
          },
          onLoading: (loading: boolean) => set({ purchasing: loading }),
          errorMessage: "start checkout process",
        }),

      setError: (error: string | null) => {
        set({ error });
      },

      clearSubscription: () => {
        set({
          subscription: null,
          isLoading: false,
          error: null,
          lastFetchTime: 0,
          hasFetched: false,
        });
      },

      refetch: async () => {
        set({ hasFetched: false }); // Force refetch
        await get().fetchSubscription();
      },
    }),
);

// Auto-initialization hook (call this in a component that mounts when user is authenticated)
export const useInitializeSubscription = () => {
  const { data: session, status } = useSession();
  const { fetchSubscription, hasFetched } = useSubscriptionStore();

  useEffect(() => {
    const initializeSubscription = async () => {
      // Skip if we've already fetched subscription data
      if (hasFetched) {
        return;
      }

      // Only initialize when we have confirmed authentication
      if (status === "authenticated" && session?.user) {
        await fetchSubscription();
      }
    };

    initializeSubscription();
  }, [status, session, hasFetched, fetchSubscription]);
};
