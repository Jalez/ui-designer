"use client";

import { AlertCircle, CheckCircle, Clock, Crown, Loader2, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type { Subscription } from "@/app/api/_lib/services/stripeService/subscriptionService";
import { Button } from "@/components/tailwind/ui/button";
import { useSubscriptionStore } from "./stores/subscriptionStore";

interface SubscriptionStatusProps {
  initialSubscription?: Subscription;
}

export function SubscriptionStatus({ initialSubscription }: SubscriptionStatusProps) {
  const {
    subscription: storeSubscription,
    isLoading: storeLoading,
    hasFetched,
    manageSubscription,
    purchasing: managing,
  } = useSubscriptionStore();
  const [subscription, setSubscription] = useState<Subscription | null>(initialSubscription || null);
  const [loading, setLoading] = useState(!initialSubscription && !hasFetched && !storeLoading);
  const [error, setError] = useState<string | null>(null);

  // Combined loading state from both component and store
  const isLoading = loading || storeLoading;

  useEffect(() => {
    // If we have initial subscription data, use it
    if (initialSubscription) {
      setSubscription(initialSubscription);
      setLoading(false);
      return;
    }

    // If store has data, use it immediately
    if (storeSubscription) {
      setSubscription({
        stripeCustomerId: "", // Placeholder for store-based subscriptions
        plan: null, // We don't have plan ID from store, but we can derive it
        status: storeSubscription.status,
        currentPeriodEnd: storeSubscription.currentPeriodEnd,
        cancelAtPeriodEnd: storeSubscription.cancelAtPeriodEnd,
        features: storeSubscription.features,
        planName: storeSubscription.planName || "Plan",
        monthlyCredits: storeSubscription.monthlyCredits || 0,
        pendingPlanChange: storeSubscription.pendingPlanChange
          ? {
            plan: storeSubscription.pendingPlanChange.planName, // Use planName as plan since store doesn't have plan ID
            planName: storeSubscription.pendingPlanChange.planName,
            effectiveDate: storeSubscription.pendingPlanChange.effectiveDate,
            credits: storeSubscription.pendingPlanChange.credits,
          }
          : undefined,
      });
      setLoading(false);
      return;
    }

    // Since subscription service now always returns Stripe data, no fallback needed


  }, [initialSubscription, storeSubscription, hasFetched, storeLoading]);



  const handleUpgrade = () => {
    window.location.href = "/subscription";
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            <div className="h-6 w-24 bg-gray-300 dark:bg-muted rounded animate-pulse"></div>
          </div>
          <div className="flex items-center space-x-1">
            <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
            <div className="h-4 w-16 bg-gray-300 dark:bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        <div className="h-4 w-32 bg-gray-300 dark:bg-muted rounded mb-3 animate-pulse"></div>
        <div className="flex space-x-2">
          <div className="h-8 w-32 bg-gray-300 dark:bg-muted rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-red-800 dark:text-red-200">Error Loading Subscription</h3>
        </div>
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (!subscription) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600";
      case "canceled":
        return "text-red-600";
      case "past_due":
        return "text-orange-600";
      default:
        return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4" />;
      case "canceled":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">{subscription.planName || "Free"} Plan</h3>
        </div>
        <div className={`flex items-center space-x-1 ${getStatusColor(subscription.status)}`}>
          {getStatusIcon(subscription.status)}
          <span className="text-sm font-medium capitalize">{subscription.status}</span>
        </div>
      </div>

      {subscription.currentPeriodEnd && (
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          {subscription.cancelAtPeriodEnd ? (
            <span className="text-red-600">
              Expires on {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}
            </span>
          ) : (
            <span>Renews on {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Pending Plan Change */}
      {subscription.pendingPlanChange && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3">
          <div className="flex items-center space-x-2 mb-2">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Plan Change Scheduled</span>
          </div>
          <div className="text-sm text-blue-700 dark:text-blue-300">
            Your plan will change to <span className="font-semibold">{subscription.pendingPlanChange.planName}</span> on{" "}
            {new Date(subscription.pendingPlanChange.effectiveDate * 1000).toLocaleDateString()}.
          </div>
          {subscription.pendingPlanChange.credits > 0 && (
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              You&apos;ll have {subscription.pendingPlanChange.credits} monthly credits.
            </div>
          )}
        </div>
      )}

      <div className="flex space-x-2">
        {subscription.status === "active" && subscription.monthlyCredits && subscription.monthlyCredits > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={manageSubscription}
            disabled={managing}
            className="flex items-center space-x-1"
          >
            <Settings className="h-4 w-4" />
            <span>{managing ? "Loading..." : "Manage Subscription"}</span>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={handleUpgrade}
          >
            Upgrade
          </Button>
        )}
      </div>
    </div>
  );
}
