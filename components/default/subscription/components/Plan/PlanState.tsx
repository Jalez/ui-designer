import { Crown, Star, X } from "lucide-react"
import { usePlanContext } from "./PlanContext";

export const PlanState = () => {
    const { plan } = usePlanContext();

    return (
        <>
            {plan.cancelledPlan && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-red-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <X className="h-3 w-3" />
                        Cancelled Plan
                    </div>
                </div>
            )}
            {plan.currentPlan && !plan.cancelledPlan && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        Current Plan
                    </div>
                </div>
            )}
            {plan.popular && !plan.currentPlan && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        Most Popular
                    </div>
                </div>
            )}

        </>
    )
}