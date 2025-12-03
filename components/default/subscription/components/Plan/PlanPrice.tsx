"use client";

import type { PricingPlan } from "./PlanCard";

interface PlanPriceProps {
    plan: PricingPlan;
    isYearly: boolean;
    getYearlyPrice: (monthlyPrice: number) => number;
}

export const PlanPrice: React.FC<PlanPriceProps> = ({
    plan,
    isYearly,
    getYearlyPrice,
}) => {
    return (
        <div className="text-center">
            <div className="flex items-baseline justify-center">
                <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    ${isYearly ? getYearlyPrice(plan.price) : plan.price}
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                    /{isYearly ? "year" : plan.period}
                </span>
            </div>
            {isYearly && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    Save ${plan.price * 2} per year
                </p>
            )}
        </div>
    );
};
