"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { NotificationProvider } from "@/components/default/notifications";
import { LoadingProvider } from "@/components/default/loading";
import { SidebarCollapseProvider } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { Sidebar } from "@/components/default/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReduxProvider } from "@/components/providers/ReduxProvider";

interface LayoutClientProps {
  children: React.ReactNode;
}

export function LayoutClient({ children }: LayoutClientProps) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <NotificationProvider>
          <LoadingProvider>
            <TooltipProvider>
              <SidebarCollapseProvider>
                <ReduxProvider>
                  <div className="flex h-full">
                    <Sidebar 
                      isUserAdmin={false} 
                      sidebarHeader={
                        <div className="p-4 font-bold text-xl text-foreground">
                          UI Designer
                        </div>
                      }
                    >
                      {/* Custom navigation items for ui-designer */}
                    </Sidebar>
                    <main className="flex-1 overflow-auto">
                      {children}
                    </main>
                  </div>
                </ReduxProvider>
              </SidebarCollapseProvider>
            </TooltipProvider>
          </LoadingProvider>
        </NotificationProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}

