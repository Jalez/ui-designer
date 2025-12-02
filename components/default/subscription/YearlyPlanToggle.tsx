import { Button } from "@/components/tailwind/ui/button";


export const YearlyPlanToggle = ({ isYearly, handleBillingToggle }: { isYearly: boolean, handleBillingToggle: (isYearly: boolean) => void }) => {

    return (
        <div className="flex justify-center mb-20">
            <div className="bg-white dark:bg-card rounded-lg p-1 border border-gray-200 dark:border-border">
                <Button variant="ghost" onClick={() => handleBillingToggle(false)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${!isYearly ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}>Monthly</Button>
                <Button variant="ghost" onClick={() => handleBillingToggle(true)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${isYearly ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900" : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}>Yearly
                    <span className="ml-1 px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full">
                        Save 20%
                    </span>
                </Button>
            </div>
        </div>
    );
}