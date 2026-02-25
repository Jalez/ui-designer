import { useSession } from "next-auth/react";
import React from "react";
import { create } from "zustand";
import {
  checkCreditsForService as checkCreditsForServiceService,
  fetchCredits as fetchCreditsService,
} from "../services";
import type { CreditData } from "../types";

/**
 * Credits Store - Centralized state management for user credit balance.
 *
 * Responsibilities:
 * - Credit balance tracking
 * - Credit deduction operations
 * - Service cost validation
 * - Auto-fetching on authentication
 */

interface CreditsStore {
  // Data
  credits: CreditData | null;
  isLoading: boolean;
  hasFetchedCredits: boolean;

  // Actions
  fetchCredits: (userId: string) => Promise<void>;
  checkCreditsForService: (
    serviceName: string,
  ) => Promise<{ hasEnough: boolean; requiredCredits: number; currentCredits: number }>;
  updateCreditsLocally: (newCredits: number) => void;
  deductCreditsLocally: (amount: number) => void;
  updateCreditsFromResponse: (remainingCredits: number) => void;

  // Internal state for rate limiting
  lastFetchTime: number;
}

const initialState = {
  credits: null,
  isLoading: false,
  hasFetchedCredits: false,
  lastFetchTime: 0,
};

export const useCreditsStore = create<CreditsStore>((set, get) => ({
  ...initialState,

  fetchCredits: async (userId: string) => {
    const state = get();

    // Prevent duplicate initial fetches - if already fetched, skip
    if (state.hasFetchedCredits) {
      return;
    }

    // Prevent fetching too frequently (at least 2 seconds between fetches)
    const now = Date.now();
    if (now - state.lastFetchTime < 2000) {
      return;
    }

    // Prevent duplicate concurrent fetches
    if (state.isLoading) {
      return;
    }

    set({ isLoading: true, lastFetchTime: now });

    try {
      const data = await fetchCreditsService(userId);
      set({
        credits: {
          current: data.credits,
        },
        hasFetchedCredits: true,
      });
    } catch (error) {
      console.error("Failed to fetch credits:", error);

      // If it's a 401 error (unauthorized), set credits to 0
      if (error instanceof Error && error.message.includes("401")) {
        set({
          credits: { current: 0 },
          hasFetchedCredits: true,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  checkCreditsForService: async (serviceName: string) => {
    return await checkCreditsForServiceService(serviceName);
  },

  updateCreditsLocally: (newCredits: number) => {
    set((state) => ({
      credits: state.credits
        ? {
            ...state.credits,
            current: newCredits,
          }
        : null,
    }));
  },

  deductCreditsLocally: (amount: number) => {
    console.log("🔍 deductCreditsLocally called with amount:", amount);
    console.log("🔍 Current credits before deduction:", get().credits?.current);

    set((state) => {
      if (!state.credits) {
        console.warn("⚠️ No credits state available for local deduction");
        return state;
      }

      const newAmount = Math.max(0, state.credits.current - amount);
      console.log("✅ Credits deducted locally:", {
        previous: state.credits.current,
        deducted: amount,
        new: newAmount,
      });

      return {
        credits: {
          ...state.credits,
          current: newAmount,
        },
      };
    });
  },

  updateCreditsFromResponse: (remainingCredits: number) => {
    console.log("🔄 Updating credits from API response:", remainingCredits);
    set((state) => ({
      credits: state.credits
        ? {
            ...state.credits,
            current: remainingCredits,
          }
        : { current: remainingCredits },
    }));
  },
}));
