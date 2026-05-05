"use client";

import { Trash2, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect, createContext, useContext } from "react";
import { Drawer, DrawerContentLeft } from "@/components/tailwind/ui/drawer";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";
import { SidebarLink } from "./SidebarLink";
import { UserProfileMenu } from "./UserProfileMenu";
import { useGameStore } from "../games";
import { stripBasePath } from "@/lib/apiUrl";
import { useIsCreatorRoute } from "@/hooks/useIsCreatorRoute";

// Context to override isCollapsed for mobile drawer
const MobileSidebarContext = createContext<boolean>(false);
export const useMobileSidebar = () => useContext(MobileSidebarContext);

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  description?: string;
}

interface LeftSidebarProps {
  isUserAdmin: boolean;
  sidebarHeader?: React.ReactNode;
  children?: React.ReactNode;
}

export const Sidebar: React.FC<LeftSidebarProps> = ({ isUserAdmin, sidebarHeader, children }) => {
  const {
    isCollapsed,
    isMobile,
    isOverlayOpen,
    hasResolvedResponsiveState,
    closeOverlay,
    setIsOverlayOpen,
    isVisible,
    setIsVisible,
    toggleCollapsed,
  } = useSidebarCollapse();
  const pathname = usePathname();
  const normalizedPathname = stripBasePath(pathname);
  const isCreatorRoute = useIsCreatorRoute();
  const game = useGameStore((state) => {
    if (!state.currentGameId) {
      return null;
    }

    return state.games.find((candidate) => candidate.id === state.currentGameId) ?? null;
  });

  const isGameRoute = normalizedPathname.startsWith("/game/");
  const isAuthRoute = normalizedPathname.startsWith("/auth/");
  const isHomeRoute = normalizedPathname === "/";
  const isPlayerRoute = isGameRoute;
  const showInlineSidebarOnMobile = false;
  const shouldShowDesktopSidebar = showInlineSidebarOnMobile || !isMobile;
  const desktopSidebarWidthClass = isCollapsed ? "w-16" : "w-64";
  const isResolvingGameOnGameRoute = isGameRoute && !game;
  const shouldHideForPlayerContext = isPlayerRoute && Boolean(game?.hideSidebar);
  const shouldHideSidebar =
    isResolvingGameOnGameRoute || (!isCreatorRoute && shouldHideForPlayerContext) || isAuthRoute;
  useEffect(() => {
    setIsVisible(!shouldHideSidebar);
    if (shouldHideSidebar && isOverlayOpen) {
      closeOverlay();
    }
  }, [closeOverlay, isOverlayOpen, setIsVisible, shouldHideSidebar]);

  const handleItemClick = () => {
    // Close overlay on mobile after navigation (Link handles the actual navigation)
    if (isMobile && isOverlayOpen) {
      closeOverlay();
    }
  };

  const isActive = (href: string) => {
    return normalizedPathname === href;
  };

  const handleDesktopRailClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile || !isCollapsed) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, input, select, textarea, [role='button']")) {
      return;
    }

    toggleCollapsed();
  };

  // Get navigation items based on admin status
  const getAdminNavItems = () => {
    const items: NavItem[] = [];

    // Add admin items if user is admin
    if (isUserAdmin) {
      items.push({
        id: "admin-users",
        label: "User Management",
        icon: <Users className="h-5 w-5" />,
        href: "/admin/users",
        description: "Manage users and permissions",
      });
      items.push({
        id: "admin-maintenance",
        label: "Maintenance",
        icon: <Trash2 className="h-5 w-5" />,
        href: "/admin/maintenance",
        description: "Purge orphan levels and maps",
      });
    }

    return items;
  };

  const shouldDelaySidebarRender = !hasResolvedResponsiveState && isMobile;

  if (shouldDelaySidebarRender || !isVisible || shouldHideSidebar) {
    return null;
  }

  const renderSidebarContent = (forceExpanded: boolean) => (
    <div className="flex h-full w-full min-h-0 flex-col">
      {sidebarHeader}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="flex min-h-full flex-col">
          {/* Navigation Items (for admins) */}
          {getAdminNavItems().map((item) => (
            <SidebarLink
              key={item.id}
              {...item}
              onClick={handleItemClick}
              isActive={isActive(item.href)}
              isCollapsed={forceExpanded ? false : isCollapsed}
              title={!forceExpanded && isCollapsed ? item.label : undefined}
            />
          ))}

          {/* Application-specific content */}
          {children}

          <div className="mt-auto">
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        aria-hidden={!shouldShowDesktopSidebar}
        className={`absolute inset-y-0 left-0 z-20 h-full overflow-visible transition-[width,opacity,transform] duration-300 ease-in-out ${
          shouldShowDesktopSidebar
            ? `${desktopSidebarWidthClass} translate-x-0 opacity-100`
            : "pointer-events-none w-0 -translate-x-6 opacity-0"
        }`}
      >
        <div
          className={`group flex h-full w-full min-w-0 overflow-hidden flex-col items-start justify-start gap-2 bg-background border-r border-border/70 shadow-sm transition-[width] duration-300 ease-in-out ${
            isCollapsed ? "cursor-expand-sidebar" : ""
          }`}
          data-sidebar
          onClick={handleDesktopRailClick}
        >
          <MobileSidebarContext.Provider value={false}>
            {renderSidebarContent(false)}
          </MobileSidebarContext.Provider>
        </div>
        {isHomeRoute && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-full top-0 h-full w-32 bg-gradient-to-r from-background/85 via-background/55 to-transparent"
          />
        )}
      </div>

      {/* Mobile Sidebar Drawer */}
      {isMobile && (
        <Drawer open={isOverlayOpen} onOpenChange={setIsOverlayOpen}>
          <DrawerContentLeft className="h-full">
            <MobileSidebarContext.Provider value={true}>
              <div
                id="mobile-sidebar"
                className="flex h-full w-full min-h-0 flex-col items-start justify-start gap-2 z-20 bg-background border-r border-border/70 shadow-sm"
                data-sidebar
              >
                {renderSidebarContent(true)}
              </div>
            </MobileSidebarContext.Provider>
          </DrawerContentLeft>
        </Drawer>
      )}
    </>
  );
};
