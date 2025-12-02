"use client";

import { Suspense } from "react";
import type { Subscription } from "@/app/api/_lib/services/stripeService/subscriptionService";
import { SubscriptionStatus } from "./SubscriptionStatus";
import { SubscriptionStatusSkeleton } from "./SubscriptionStatusSkeleton";

interface SubscriptionStatusWrapperProps {
    subscriptionPromise: Promise<Subscription>;
}

function SubscriptionStatusContent({ subscriptionPromise }: { subscriptionPromise: Promise<Subscription> }) {
    // This will suspend until the promise resolves
    const subscription = subscriptionPromise as any; // TypeScript workaround for React's Suspense

    return <SubscriptionStatus initialSubscription={subscription} />;
}

export function SubscriptionStatusWrapper({ subscriptionPromise }: SubscriptionStatusWrapperProps) {
    return (
        <Suspense fallback={<SubscriptionStatusSkeleton />}>
            <SubscriptionStatusContent subscriptionPromise={subscriptionPromise} />
        </Suspense>
    );
}
