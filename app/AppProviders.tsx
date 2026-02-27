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

const ToasterProvider = () => {
  const { theme } = useTheme() as {
    theme: "light" | "dark" | "system";
  };
  return <Toaster theme={theme} />;
};

const AppInitializer = () => {
  const { status } = useSession();

  useEffect(() => {
    // Billing/credits initialization intentionally disabled.
    if (status === "loading") {
      return;
    }
  }, [status]);

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
