"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
// Plans are now managed in Stripe only
import { useSubscriptionStore } from "../../stores";
import { executeAsync } from "../../utils/executeAsync";

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
    currentPlan?: boolean;
    cancelledPlan?: boolean;
    isUpgrade?: boolean;
    isDowngrade?: boolean;
    stripeProductId?: string;
    stripeMonthlyPriceId?: string;
    stripeYearlyPriceId?: string;
}

interface PlanContextType {
    // State
    currentPlan: PricingPlan | null;

    // Actions
    subscribe: (plan: PricingPlan, isYearly: boolean) => Promise<void>;

    // Plan data
    plan: PricingPlan;
    isYearly: boolean;
}

interface PlanProviderProps {
    plan: PricingPlan;
    children: ReactNode;
    isYearly: boolean;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export const PlanProvider: React.FC<PlanProviderProps> = ({ plan, children, isYearly }) => {
    // Note: isAdding and isRemoving states removed since database plan management is no longer needed
    const [currentPlan, setCurrentPlan] = useState<PricingPlan | null>(plan || null);
    const { subscribe } = useSubscriptionStore();

    // Update currentPlan when plan prop changes
    useEffect(() => {
        if (plan) setCurrentPlan(plan);
    }, [plan]);

    const value: PlanContextType = {
        currentPlan,
        subscribe,
        plan,
        isYearly,
    };

    return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
};

export const usePlanContext = () => {
    const context = useContext(PlanContext);
    if (context === undefined) {
        throw new Error("usePlanContext must be used within a PlanProvider");
    }
    return context;
};
