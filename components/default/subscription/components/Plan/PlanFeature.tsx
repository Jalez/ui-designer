"use client";

import { Check, Coins } from "lucide-react";
import { formatCredits } from "@/components/default/credits/utils/creditCalculator";
import type { Subscription } from "../../stores";
import type { PricingPlan } from "./PlanCard";

interface PlanFeatureProps {
    feature: string;
    index: number;
    plan: PricingPlan;
    subscription: Subscription | null;
}

export const PlanFeature: React.FC<PlanFeatureProps> = ({ feature, index, plan, subscription }) => {
    // For the first feature (credits), use subscription data if available and this is current plan
    let displayFeature = feature;
    if (index === 0 && plan.currentPlan && subscription?.monthlyCredits) {
        // Replace the credits amount in the feature string (matches "1K", "3K", "1.5M", etc.)
        const creditsMatch = feature.match(/([\d,]+(?:\.\d+)?[KM]?)/);
        if (creditsMatch) {
            displayFeature = feature.replace(creditsMatch[1], formatCredits(subscription.monthlyCredits));
        }
    }

    return (
        <div className="flex items-center gap-3">
            {index === 0 ? (
                <Coins className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            ) : (
                <Check className="h-5 w-5 text-green-500 flex-shrink-0" />
            )}
            <span
                className={`${index === 0 ? "font-semibold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}
            >
                {displayFeature}
            </span>
        </div>
    );
};
