"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/tailwind/ui/card";
import type { Subscription } from "../../stores";
// Admin buttons removed - plans are now managed in Stripe only
import { PlanCardButtons } from "./PlanCardButtons";
import { usePlanContext } from "./PlanContext";
import { PlanFeature } from "./PlanFeature";
import { PlanPrice } from "./PlanPrice";
import { PlanState } from "./PlanState";

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
  stripeProductId?: string;
  stripeMonthlyPriceId?: string;
  stripeYearlyPriceId?: string;
  dbPlan?: any;
}

interface PlanCardProps {
  subscription: Subscription | null;
  getYearlyPrice: (monthlyPrice: number) => number;
  isAdmin: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({ subscription, getYearlyPrice, isAdmin }) => {
  const { plan, isYearly } = usePlanContext();
  return (
    <Card
      className={`relative transition-all min-w-[380px] flex flex-col justify-between duration-200 hover:shadow-xl bg-gray-50 dark:bg-muted/30 ${plan.cancelledPlan
        ? "border-red-500 dark:border-red-400 ring-2 ring-red-500/20"
        : plan.currentPlan
          ? "border-green-500 dark:border-green-400 ring-2 ring-green-500/20"
          : plan.popular
            ? "border-gray-900 dark:border-white"
            : "border-gray-200 dark:border-gray-700"
        }`}
    >
      {/* Admin buttons removed - plans are managed in Stripe only */}
      <PlanState />
      <CardHeader className="flex items-center flex-col ">
        <CardTitle className="text-2xl font-bold">{plan.name}</CardTitle>
        <CardDescription className="text-base mt-2">{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Price */}
        <PlanPrice plan={plan} isYearly={isYearly} getYearlyPrice={getYearlyPrice} />

        {/* Features */}
        {plan.features.map((feature, index) => (
          <PlanFeature key={feature} feature={feature} index={index} plan={plan} subscription={subscription} />
        ))}

        {/* CTA Button */}
        <PlanCardButtons />
      </CardContent>
    </Card>
  );
};
