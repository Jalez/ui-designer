"use client";

import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/tailwind/ui/button";
import { useSubscriptionStore } from "./stores";

interface PremiumGateProps {
  children: React.ReactNode;
  feature?: string;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export function PremiumGate({ children, feature = "this feature", fallback, showUpgrade = true }: PremiumGateProps) {
  const { subscription, isLoading } = useSubscriptionStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600" />
      </div>
    );
  }

  // Allow access for premium plans
  if (
    subscription &&
    subscription?.monthlyCredits &&
    subscription.monthlyCredits > 0 &&
    subscription.status === "active"
  ) {
    return <>{children}</>;
  }

  // Show fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Show upgrade prompt
  if (showUpgrade) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
        <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 dark:bg-yellow-900/20 rounded-full mb-4">
          <Lock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Premium Feature</h3>

        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm">
          Upgrade to a premium plan to access {feature} and unlock advanced capabilities.
        </p>

        <Button
          onClick={() => {
            window.location.href = "/subscription";
          }}
          className="bg-yellow-500 hover:bg-yellow-600 text-white flex items-center space-x-2"
        >
          <Crown className="h-4 w-4" />
          <span>Upgrade Now</span>
        </Button>
      </div>
    );
  }

  return null;
}

// Higher-order component for wrapping components with premium gate
export function withPremiumGate<P extends object>(Component: React.ComponentType<P>, feature?: string) {
  return function PremiumWrappedComponent(props: P) {
    return (
      <PremiumGate feature={feature}>
        <Component {...props} />
      </PremiumGate>
    );
  };
}
