"use client";

import { Button } from "@/components/ui/button";
import { createGame } from "@/components/default/games/service/basic/create";
import { Loader2, LogIn, PanelLeft, Play, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { stripBasePath } from "@/lib/apiUrl";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";

export const RouteSidebarNavbar = () => {
  const { isMobile, isOverlayOpen, isVisible, openOverlay } = useSidebarCollapse();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const isHomeRoute = normalizedPathname === "/";

  const isGameRoute = normalizedPathname.startsWith("/game/");
  const isCreatorRoute = useIsCreatorRoute();
  const isAuthRoute = normalizedPathname.startsWith("/auth/");
  const shouldRender = isMobile && isVisible && !isOverlayOpen && !isGameRoute && !isCreatorRoute && !isAuthRoute;
  const isLoading = status === "loading";

  const handleCreateGame = async () => {
    try {
      setIsCreating(true);
      const game = await createGame({ title: "New Game" });
      router.push(`/creator/${game.id}`);
    } catch (error) {
      console.error("Failed to create game:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <nav
      aria-label="Sidebar navigation bar"
      className={`bg-transparent border-0 shadow-none ${
        isHomeRoute ? "absolute inset-x-0 top-0 z-20" : ""
      }`}
    >
      <div className={`flex items-center gap-2 px-2 ${isHomeRoute ? "h-auto py-2" : "h-12"}`}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 bg-background text-foreground border border-border/70 shadow-sm hover:bg-background pointer-events-auto"
          onClick={openOverlay}
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        {isHomeRoute && (
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex items-center gap-2 pr-2">
              {isLoading ? (
                <Button size="sm" disabled className="h-8 shrink-0 gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading
                </Button>
              ) : session ? (
                <>
                  <Link href="/games">
                    <Button size="sm" className="h-8 shrink-0 gap-2">
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Start
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 shrink-0 gap-2"
                    onClick={handleCreateGame}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Create
                  </Button>
                </>
              ) : (
                <Link href="/auth/signin">
                  <Button size="sm" className="h-8 shrink-0 gap-2">
                    <LogIn className="h-3.5 w-3.5" />
                    Log in
                  </Button>
                </Link>
              )}
              <Link href="/help">
                <Button size="sm" variant="outline" className="h-8 shrink-0">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
