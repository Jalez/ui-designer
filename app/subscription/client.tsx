"use client";

import { useEffect, useState } from "react";
import { PlanCard } from "@/components/default/subscription/components/Plan/PlanCard";
import { PlanProvider } from "@/components/default/subscription/components/Plan/PlanContext";
import { usePlansStore, useSubscriptionStore } from "@/components/default/subscription/stores";
import { YearlyPlanToggle } from "@/components/default/subscription/YearlyPlanToggle";
import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { PageHeader } from "@/components/scriba/ui/PageHeader";

interface SubscriptionPageClientProps {
    isAdmin: boolean;
}

export default function SubscriptionPageClient({ isAdmin }: SubscriptionPageClientProps) {

    // Use Zustand stores
    const { pricingPlans, isLoadingPlans, plansError, fetchAllPlans } =
        usePlansStore();

    const { subscription, isLoading: subscriptionLoading } = useSubscriptionStore();

    const [isYearly, setIsYearly] = useState(false);

    // Fetch all plans data on mount (subscription data is initialized globally)
    useEffect(() => {
        fetchAllPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const getYearlyPrice = (monthlyPrice: number) => {
        return Math.round(monthlyPrice * 10); // 2 months free
    };




    const getPricingPlans = () => {
        return pricingPlans.map((plan) => {
            let isCurrentPlan = false;
            let isCancelledPlan = false;

            // Only check subscription status if subscription data is available
            if (subscription?.planName) {
                if (subscription.status === "canceled") {
                    // Check if this is the cancelled plan
                    isCancelledPlan = plan.name.toLowerCase() === subscription.planName.toLowerCase();
                } else if (subscription.status === "active") {
                    // Check if this is the active current plan
                    isCurrentPlan = plan.name.toLowerCase() === subscription.planName.toLowerCase();
                }
            }

            // Calculate upgrade/downgrade status only if we have subscription data
            let isUpgrade = false;
            let isDowngrade = false;

            if (subscription?.planName && subscription?.status === "active") {
                // Find the current plan's price
                const currentPlanData = pricingPlans.find((p) => p.name.toLowerCase() === subscription.planName.toLowerCase());
                if (currentPlanData && currentPlanData.price !== plan.price) {
                    isUpgrade = plan.price > currentPlanData.price;
                    isDowngrade = plan.price < currentPlanData.price;
                }
            }

            return {
                ...plan,
                currentPlan: isCurrentPlan,
                cancelledPlan: isCancelledPlan,
                isUpgrade,
                isDowngrade,
                // Ensure required properties exist
                icon: plan.icon ?? null,
                color: plan.color ?? "from-gray-700 to-gray-900",
            };
        });
    };





    const handleBillingToggle = (isYearly: boolean) => {
        setIsYearly(isYearly);
    };

    return (
        <PageContainer>
            <PageHeader
                title={isAdmin ? "Plan Management (Admin)" : "Choose Your Plan"}
                description={
                    isAdmin
                        ? "Manage which plans are available to users and configure plan settings"
                        : "Unlock the full potential of our AI-powered document processing platform"
                }
            />


            <>
                {/* Only show billing toggle and plans when plans are loaded */}
                {isLoadingPlans ? (
                    <div className="text-center py-12">
                        <div className="inline-flex items-center text-gray-500 dark:text-gray-400">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mr-3"></div>
                            Loading your plan information...
                        </div>
                    </div>
                ) : plansError ? (
                    <div className="text-center py-12">
                        <div className="text-red-600 dark:text-red-400 mb-2">Failed to load plans</div>
                        <div className="text-gray-600 dark:text-gray-400 text-sm">{plansError}</div>
                    </div>
                ) : (
                    <>
                        {/* Billing Toggle */}
                        <YearlyPlanToggle isYearly={isYearly} handleBillingToggle={handleBillingToggle} />

                        {/* Pricing Cards */}
                        <div className="flex flex-row flex-wrap gap-3 justify-around">
                            {getPricingPlans().map((plan) => (
                                <PlanProvider key={plan.id} plan={plan} isYearly={isYearly}>
                                    <PlanCard
                                        subscription={subscription}
                                        getYearlyPrice={getYearlyPrice}
                                        isAdmin={isAdmin}
                                    />
                                </PlanProvider>
                            ))}
                        </div>

                        {/* Subscription status indicator */}
                        {subscriptionLoading && (
                            <div className="text-center mb-4">
                                <div className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                                    Checking your subscription status...
                                </div>
                            </div>
                        )}

                    </>
                )}
            </>

        </PageContainer>
    );
}


