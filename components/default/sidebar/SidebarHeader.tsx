"use client";

import { ChevronLeft, Layout } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { useSidebarCollapse } from "./context/SidebarCollapseContext";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarHeaderProps {
  showCloseButton?: boolean;
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({ showCloseButton = true }) => {
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse();
  const [shouldShowText, setShouldShowText] = useState(false);

  // Start showing text after sidebar transition completes using transitionend event
  useEffect(() => {
    if (!isCollapsed) {
      const handleTransitionEnd = (event: TransitionEvent) => {
        // Only respond to width transitions on the sidebar
        if (event.propertyName === "width") {
          setShouldShowText(true);
        }
      };

      // Find the sidebar element and listen for transitionend
      const sidebarElement = document.querySelector("[data-sidebar]");
      if (sidebarElement) {
        sidebarElement.addEventListener("transitionend", handleTransitionEnd);

        // Also set a fallback timer in case transitionend doesn't fire
        // This handles the case where sidebar is already open on page load
        const fallbackTimer = setTimeout(() => {
          setShouldShowText(true);
        }, 100); // Small delay to ensure DOM is ready

        return () => {
          sidebarElement.removeEventListener("transitionend", handleTransitionEnd);
          clearTimeout(fallbackTimer);
        };
      } else {
        // Fallback: use a timeout if we can't find the element
        const timer = setTimeout(() => setShouldShowText(true), 350);
        return () => clearTimeout(timer);
      }
    } else {
      setShouldShowText(false);
    }
  }, [isCollapsed]);

  return (
    <div className="flex items-center h-12 relative w-full">
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href="/"
            className="flex items-center w-full h-full p-4 hover:bg-gray-200 dark:hover:bg-muted transition-colors"
          >
            {/* Logo/Icon */}
            <div className="flex items-center justify-start w-8 flex-shrink-0">
              <Layout className="w-6 h-6 text-gray-900 dark:text-white" />
            </div>

            {/* Title - Only show when sidebar is expanded and transition is complete */}
            {!isCollapsed && shouldShowText && (
              <div className="flex items-center pl-2 min-w-0 flex-1">
                <span className="text-lg font-medium text-gray-900 dark:text-white whitespace-nowrap">UI Designer</span>
              </div>
            )}

            {/* Invisible placeholder to maintain layout while transition is happening */}
            {!isCollapsed && !shouldShowText && (
              <div className="flex items-center pl-2 min-h-[24px] min-w-0 flex-1">
                <span className="text-lg font-medium text-gray-900 dark:text-white opacity-0 whitespace-nowrap">UI Designer</span>
              </div>
            )}
          </Link>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right" className="ml-2 z-[10000]">
            <p>UI Designer</p>
          </TooltipContent>
        )}
      </Tooltip>

      {/* Close Button - Only show when not collapsed and enabled */}
      {!isCollapsed && showCloseButton && (
        <Button
          variant="ghost"
          onClick={toggleCollapsed}
          className="absolute right-2 flex-shrink-0 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-muted transition-colors"
          title="Close Sidebar"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        </Button>
      )}
    </div>
  );
};



