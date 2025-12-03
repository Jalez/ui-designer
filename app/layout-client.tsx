import { cookies } from "next/headers";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { authOptions } from "@/lib/auth";
import { LayoutClientInner } from "./layout-client-inner";

interface LayoutClientProps {
  children: ReactNode;
}

export async function LayoutClient({ children }: LayoutClientProps) {
  // Read sidebar state from cookies on the server
  const initialSidebarCollapsed = await (async () => {
    try {
      const cookieStore = await cookies();
      const sidebarCookie = cookieStore.get("sidebar-collapsed")?.value;
      if (!sidebarCookie) {
        return true;
      }

      const decodedValue = decodeURIComponent(sidebarCookie);
      if (decodedValue === "true") {
        return true;
      }
      if (decodedValue === "false") {
        return false;
      }
      if (decodedValue === "undefined") {
        return true; // Default to collapsed if undefined
      }

      // Fall back to JSON parsing for future extensibility
      return JSON.parse(decodedValue);
    } catch (error) {
      console.error("Error reading sidebar cookie:", error);
      return true;
    }
  })();

  // Get session on server to pass to SessionProvider (eliminates initial /api/auth/session call)
  const session = (await getServerSession(authOptions)) as Session | null;

  // Check admin status on the server (with defensive handling)
  const isUserAdmin = false; // Default to false for now, can be enhanced later

  return (
    <LayoutClientInner 
      initialSidebarCollapsed={initialSidebarCollapsed} 
      isUserAdmin={isUserAdmin}
      session={session}
    >
      {children}
    </LayoutClientInner>
  );
}
