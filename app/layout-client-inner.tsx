"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SidebarCollapseProvider } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { Sidebar, SidebarProjectList, SidebarHeader } from "@/components/default/sidebar";
import { usePathname, useSearchParams } from "next/navigation";
import Providers from "./AppProviders";

interface LayoutClientInnerProps {
  children: ReactNode;
  initialSidebarCollapsed: boolean;
  isUserAdmin: boolean;
  session: Session | null;
}

export function LayoutClientInner({ 
  children, 
  initialSidebarCollapsed, 
  isUserAdmin,
  session 
}: LayoutClientInnerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Get mode from URL params
  const mode = searchParams.get("mode") || "test";
  const isGameMode = mode === "game";
  
  // Determine if sidebar should be hidden based on the current route or mode
  const shouldHideSidebar = pathname === '/drawboard' || isGameMode;
  
  return (
    <Providers session={session}>
      <SidebarCollapseProvider initialCollapsed={initialSidebarCollapsed}>
        <div className="flex h-full">
          <Sidebar 
            isUserAdmin={isUserAdmin}
            sidebarHeader={<SidebarHeader />}
          >
            <SidebarProjectList isUserAdmin={isUserAdmin} />
          </Sidebar>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </SidebarCollapseProvider>
    </Providers>
  );
}

