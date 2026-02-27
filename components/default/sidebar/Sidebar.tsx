"use client";

import { Settings, Users } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, createContext, useContext } from "react";
import { Drawer, DrawerContentLeft } from "@/components/tailwind/ui/drawer";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";
import { ExpandButton } from "./SidebarExpandButton";
import { SidebarLink } from "./SidebarLink";
import { UserProfileMenu } from "./UserProfileMenu";
import { useGameStore } from "../games";
import { useAppSelector } from "@/store/hooks/hooks";

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
  const { isCollapsed, isMobile, isOverlayOpen, closeOverlay, setIsOverlayOpen, isVisible, setIsVisible } = useSidebarCollapse();
  const pathname = usePathname();
  const options = useAppSelector((state) => state.options);
  const getCurrentGame = useGameStore((state) => state.getCurrentGame);
  const game = getCurrentGame();

  const searchParams = useSearchParams();
  const isGameMode = options.mode === "game" || searchParams.get("mode") === "game";
  const isPlayRoute = pathname.startsWith("/play/");
  const isAuthRoute = pathname.startsWith("/auth/");
  const shouldHideSidebar = Boolean(game?.hideSidebar) || isGameMode || isPlayRoute || isAuthRoute;

  useEffect(() => {
    setIsVisible(!shouldHideSidebar);
  }, [shouldHideSidebar, setIsVisible]);

  const handleItemClick = () => {
    // Close overlay on mobile after navigation (Link handles the actual navigation)
    if (isMobile && isOverlayOpen) {
      closeOverlay();
    }
  };

  const isActive = (href: string) => {
    return pathname === href;
  };

  // Get navigation items based on admin status
  const getAdminNavItems = () => {
    const items: NavItem[] = [];

    // Add admin items if user is admin
    if (isUserAdmin) {
      // Add admin-specific items
      items.push({
        id: "admin-providers-models",
        label: "Providers & Models",
        icon: <Settings className="h-5 w-5" />,
        href: "/admin/providers-models",
        description: "Manage AI providers and models",
      });
      items.push({
        id: "admin-users",
        label: "User Management",
        icon: <Users className="h-5 w-5" />,
        href: "/admin/users",
        description: "Manage users and permissions",
      });
    }

    return items;
  };

  // Close overlay when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOverlayOpen && isMobile) {
        console.log("isOverlayOpen", isOverlayOpen);
        const sidebar = document.getElementById("mobile-sidebar");
        if (sidebar && !sidebar.contains(event.target as Node)) {
          closeOverlay();
        }
      }
    };

    if (isOverlayOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOverlayOpen, isMobile, closeOverlay]);

  if (!isVisible || shouldHideSidebar) {
    return null;
  }

  // Render immediately with default values, responsive state will update shortly

  const renderSidebarContent = (forceExpanded: boolean) => (
    <>
      {sidebarHeader}

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

      {/* Spacer to push credits and profile to bottom on mobile only */}
      {forceExpanded && <div className="flex-1" />}

      {!forceExpanded && <ExpandButton />}

      <UserProfileMenu />
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div
        className={`hidden md:flex flex-col items-start justify-start gap-2 relative group h-full bg-muted/30 transition-all duration-300 ease-in-out ${
          isCollapsed ? "w-16" : "w-64"
        }`}
        data-sidebar
      >
        <MobileSidebarContext.Provider value={false}>
          {renderSidebarContent(false)}
        </MobileSidebarContext.Provider>
      </div>

      {/* Mobile Sidebar Drawer */}
      <Drawer open={isOverlayOpen} onOpenChange={setIsOverlayOpen}>
        <DrawerContentLeft className="md:hidden h-full">
          <MobileSidebarContext.Provider value={true}>
            <div
              id="mobile-sidebar"
              className="flex flex-col items-start justify-start gap-2 h-full bg-muted/30 w-full"
              data-sidebar
            >
              {renderSidebarContent(true)}
            </div>
          </MobileSidebarContext.Provider>
        </DrawerContentLeft>
      </Drawer>
    </>
  );
};
