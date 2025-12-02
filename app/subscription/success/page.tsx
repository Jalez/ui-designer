"use client";

import { ArrowRight, Calendar, CheckCircle, Coins, CreditCard } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import { useSubscriptionStore, useInitializeSubscription } from "@/components/default/subscription/stores";
import { ProgressivePage } from "@/components/scriba/ui/ProgressivePage";
import { Button } from "@/components/tailwind/ui/button";

function SubscriptionSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { subscription, isLoading } = useSubscriptionStore();
  useInitializeSubscription();
  const [isProcessing, setIsProcessing] = useState(true);
  const [headerText, setHeaderText] = useState<string | null>(null);
  const [descriptionText, setDescriptionText] = useState<string | null>(null);
  const [_isPlanChange, setIsPlanChange] = useState(false);
  const [changeType, setChangeType] = useState<"upgrade" | "downgrade" | "new" | null>(null);


  useEffect(() => {
    if (subscription) {
      setIsProcessing(false);

      // Check if this is a plan change from URL parameters
      const planChange = searchParams.get("plan_change");
      const changeTypeParam = searchParams.get("change_type");

      if (planChange === "true" && changeTypeParam) {
        setIsPlanChange(true);
        setChangeType(changeTypeParam as "upgrade" | "downgrade");

        if (subscription?.planName) {
          if (changeTypeParam === "upgrade") {
            setHeaderText(`Upgrade to ${subscription.planName} successful!`);
            setDescriptionText(
              `Your upgrade is now active! You have immediate access to all ${subscription.planName} features and your credits have been updated.`,
            );
          } else if (changeTypeParam === "downgrade") {
            setHeaderText(`Downgrade to ${subscription.planName} scheduled!`);
            setDescriptionText(
              `Your downgrade has been scheduled for your next billing cycle. You can keep using your current credits until then.`,
            );
          }
        }
      } else {
        // New subscription
        setChangeType("new");
        if (subscription?.planName) {
          setHeaderText(`Welcome to ${subscription.planName}!`);
          setDescriptionText(
            `Your subscription has been activated successfully. You now have access to all premium features.`,
          );
        }
      }
    }
  }, [subscription, searchParams]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Processing your subscription...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we set up your account.</p>
        </div>
      </div>
    );
  }

  // If no features configured in Stripe, show basic credits info
  const featureList = subscription?.features?.filter(Boolean) ?? [];
  const hasConfiguredFeatures = featureList.length > 0;

  // If no features configured, add basic credits feature
  if (!hasConfiguredFeatures && subscription?.monthlyCredits) {
    featureList.push(`${subscription.monthlyCredits.toLocaleString()} AI credits per month`);
  }
  const sections: {
    id: string;
    content: ReactNode;
  }[] = [
      {
        id: "subscription-success-description",
        content: (
          <div className="text-center">
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              {descriptionText ||
                "Your subscription has been activated successfully. You now have access to all premium features."}
            </p>

            {/* Show additional info for downgrades */}
            {changeType === "downgrade" && subscription?.currentPeriodEnd && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <div className="flex items-start space-x-3">
                  <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">Downgrade Details</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Your new plan will take effect on{" "}
                      <strong>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</strong>. Until then, you can
                      continue using your current credits and features.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Show credit info for upgrades */}
            {changeType === "upgrade" && subscription?.monthlyCredits && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
                <div className="flex items-start space-x-3">
                  <CreditCard className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="text-left">
                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-1">Credits Updated</h4>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your credits have been updated to <strong>{subscription.monthlyCredits.toLocaleString()}</strong>{" "}
                      credits per month. You now have immediate access to your new plan features!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ),
      },
    ];

  if (featureList.length > 0) {
    sections.push({
      id: "subscription-success-features",
      content: (
        <div className="max-w-3xl mx-auto rounded-lg p-6 mb-2 text-left flex flex-col gap-2 justify-center items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What&apos;s included:</h3>
          <ul className="space-y-2">
            {featureList.map((feature, index) => {
              // Check if this feature contains "credits" - if so, use coin icon
              const isCreditsFeature = feature.toLowerCase().includes('credits');

              return (
                <li key={feature} className="flex items-center text-gray-700 dark:text-gray-300">
                  {isCreditsFeature ? (
                    <Coins className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0 flex items-center justify-center font-bold text-sm" />
                  ) : index === 0 ? (
                    <div className="h-5 w-5 text-yellow-500 mr-3 flex-shrink-0 flex items-center justify-center font-bold text-sm">
                      ⚡
                    </div>
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                  )}
                  <span className={index === 0 ? "font-semibold text-gray-900 dark:text-white" : ""}>{feature}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ),
    });
  }

  sections.push(
    {
      id: "subscription-success-actions",
      content: (
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <Button
            onClick={() => router.push("/documents")}
            className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 py-3 text-lg font-medium"
          >
            Start Creating Documents
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <Button variant="outline" onClick={() => router.push("/account")} className="w-full py-3 text-lg font-medium">
            Manage Subscription
          </Button>
        </div>
      ),
    },
    {
      id: "subscription-success-info",
      content: (
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {changeType === "upgrade" &&
              "Your upgrade is complete and your credits have been updated. You can manage your subscription in your account settings."}
            {changeType === "downgrade" &&
              "Your downgrade has been scheduled for your next billing cycle. You can manage your subscription in your account settings."}
            {changeType === "new" &&
              "Your subscription has been activated and your credits have been updated. You can manage your subscription in your account settings."}
            {!changeType &&
              "Your subscription has been activated and your credits have been updated. You can manage your subscription in your account settings."}
          </p>
        </div>
      ),
    },
  );

  return (
    <ProgressivePage
      className="flex flex-col items-center justify-center px-4"
      contentWrapperClassName="w-full text-center flex flex-col"
      pageWrapperProps={{ pageType: "subscription" }}
      header={{
        text: headerText,
        fontSize: 40,
        duration: 2500,
        colors: { light: "#111827", dark: "#ffffff" },
        wrapperClassName: "text-center",
      }}
      sections={sections}
      firstSectionDelay={600}
      sectionDelay={600}
    />
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Loading...</h2>
          </div>
        </div>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  );
}
