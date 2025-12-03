"use client";

import { Analytics } from "@vercel/analytics/react";
import { SessionProvider, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { ThemeProvider, useTheme } from "next-themes";
import { type ReactNode, useEffect } from "react";
import { Toaster } from "sonner";
import { LoadingProvider } from "@/components/default/loading";
import { NotificationProvider } from "@/components/default/notifications";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReduxProvider } from "@/components/providers/ReduxProvider";
import { useCreditsStore } from "@/components/default/credits";
import { useSubscriptionStore } from "@/components/default/subscription/stores/subscriptionStore";

const ToasterProvider = () => {
  const { theme } = useTheme() as {
    theme: "light" | "dark" | "system";
  };
  return <Toaster theme={theme} />;
};

const AppInitializer = () => {
  const { data: session, status } = useSession();
  const { fetchCredits, hasFetchedCredits } = useCreditsStore();
  const { fetchSubscription, hasFetched: hasFetchedSubscription } = useSubscriptionStore();

  useEffect(() => {
    // Skip initialization if we're still loading the session
    if (status === "loading") {
      return;
    }

    const initializeApp = async () => {
      // Only initialize when we have confirmed authentication
      if (status === "authenticated" && session?.user) {
        // Initialize credits if not already fetched (global, regardless of current page)
        if (!hasFetchedCredits) {
          await fetchCredits(session.userId);
        }

        // Initialize subscription if not already fetched (global, regardless of current page)
        if (!hasFetchedSubscription) {
          await fetchSubscription();
        }
      } else if (status === "unauthenticated") {
        // User is not authenticated, set credits to 0
        useCreditsStore.setState({
          credits: { current: 0 },
          hasFetchedCredits: true,
          isLoading: false,
        });
      }
    };

    initializeApp();
  }, [status, session, hasFetchedCredits, hasFetchedSubscription, fetchCredits, fetchSubscription]);

  return null;
};

interface ProvidersProps {
  children: ReactNode;
  session?: Session | null;
}

export default function Providers({ children, session }: ProvidersProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <SessionProvider
        session={session}
        refetchOnWindowFocus={true}
        refetchInterval={0}
        refetchWhenOffline={false}
      >
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange defaultTheme="system">
          <LoadingProvider>
            <ReduxProvider>
              <NotificationProvider />
              <AppInitializer />
              <ToasterProvider />
              {children}
              <Analytics />
            </ReduxProvider>
          </LoadingProvider>
        </ThemeProvider>
      </SessionProvider>
    </TooltipProvider>
  );
}

