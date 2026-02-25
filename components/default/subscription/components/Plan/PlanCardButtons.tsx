import { Button } from "@/components/tailwind/ui/button";
import { useSubscriptionStore } from "../../stores";
import { usePlanContext } from "./PlanContext";

export const PlanCardButtons = () => {
    const { plan, subscribe, isYearly } = usePlanContext();
    const { purchasing } = useSubscriptionStore();

    const getButtonText = (): string => {
        if (plan.isUpgrade) return `Upgrade to ${plan.name}`;
        if (plan.isDowngrade) return `Downgrade to ${plan.name}`;
        return "Get Started";
    };

    return (
        <Button
            onClick={plan.currentPlan ? undefined : () => subscribe(plan, isYearly)}
            disabled={plan.currentPlan || purchasing}
            className={`w-full py-3 text-lg font-medium transition-all duration-200 ${plan.currentPlan
                ? "bg-green-500 hover:bg-green-500 text-white cursor-not-allowed"
                : "bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 disabled:opacity-50"
                }`}
        >
            {plan.currentPlan ? "✓ Current Plan" : purchasing ? "Processing..." : getButtonText()}
        </Button>
    );
};
