"use client";

import { Settings, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";
import { useEffect } from "react";
import { CreditsDisplay } from "../credits";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";
import { ExpandButton } from "./SidebarExpandButton";
import { SidebarLink } from "./SidebarLink";
import { UserProfileMenu } from "./UserProfileMenu";

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
  sidebarHeader: React.ReactNode;
  children: React.ReactNode;
}

export const Sidebar: React.FC<LeftSidebarProps> = ({ isUserAdmin, sidebarHeader, children }) => {
  const { isCollapsed, isMobile, isOverlayOpen, closeOverlay } = useSidebarCollapse();
  const pathname = usePathname();

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

  // Render immediately with default values, responsive state will update shortly

  return (
    <>
      <div
        className={`flex flex-col items-start justify-start gap-2 relative group h-full bg-muted/30 transition-all duration-300 ease-in-out ${isCollapsed ? "w-16" : "w-64"}`}
        data-sidebar
      >
        {sidebarHeader}

        {/* Navigation Items (for admins) */}
        {getAdminNavItems().map((item) => (
          <SidebarLink
            key={item.id}
            {...item}
            onClick={handleItemClick}
            isActive={isActive(item.href)}
            isCollapsed={isCollapsed}
            title={isCollapsed ? item.label : undefined}
          />
        ))}

        {/* Application-specific content */}
        {children}

        <ExpandButton />
        <CreditsDisplay compact={false} />

        <UserProfileMenu />
      </div>
    </>
  );
};
