"use client";

import type { ReactNode } from "react";
import type { Session } from "next-auth";
import { SidebarCollapseProvider } from "@/components/default/sidebar/context/SidebarCollapseContext";
import { Sidebar, SidebarProjectList } from "@/components/default/sidebar";
import { usePathname } from "next/navigation";
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
  
  // Determine if sidebar should be hidden based on the current route
  const shouldHideSidebar = pathname === '/drawboard';
  
  return (
    <Providers session={session}>
      <SidebarCollapseProvider initialCollapsed={initialSidebarCollapsed}>
        <div className="flex h-full">
          {!shouldHideSidebar && (
            <Sidebar 
              isUserAdmin={isUserAdmin} 
            >
              <SidebarProjectList isUserAdmin={isUserAdmin} />
            </Sidebar>
          )}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </SidebarCollapseProvider>
    </Providers>
  );
}

