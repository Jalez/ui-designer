"use client";

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import useSidebarPersistence from "../hooks/useSidebarPersistence";

interface SidebarCollapseState {
  isCollapsed: boolean;
  isMobile: boolean;
  isOverlayOpen: boolean;
  isVisible: boolean;
}

interface SidebarCollapseContextType {
  isCollapsed: boolean;
  isMobile: boolean;
  isOverlayOpen: boolean;
  isVisible: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setIsOverlayOpen: (open: boolean) => void;
  setIsVisible: (visible: boolean) => void;
  toggleCollapsed: () => void;
  openOverlay: () => void;
  closeOverlay: () => void;
}

const SidebarCollapseContext = createContext<SidebarCollapseContextType | undefined>(undefined);

export const useSidebarCollapse = () => {
  const context = useContext(SidebarCollapseContext);
  if (!context) {
    throw new Error("useSidebarCollapse must be used within a SidebarCollapseProvider");
  }
  return context;
};

interface SidebarCollapseProviderProps {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}

export const SidebarCollapseProvider: React.FC<SidebarCollapseProviderProps> = ({
  children,
  initialCollapsed = true
}) => {
  const [isCollapsed, setIsCollapsedState] = useSidebarPersistence("sidebar-collapsed", initialCollapsed);
  const [isMobile, setIsMobile] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  // Set initial responsive state immediately on client-side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const width = window.innerWidth;
      const isMobileScreen = width < 768; // md breakpoint
      setIsMobile(isMobileScreen);

      if (isMobileScreen) {
        setIsCollapsedState(true);
      }
    }
  }, [setIsCollapsedState]);

  // Handle responsive behavior and resize events
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const isMobileScreen = width < 768; // md breakpoint
      const isSmallScreen = width < 1024; // lg breakpoint

      setIsMobile(isMobileScreen);

      // Close overlay on larger screens
      if (!isSmallScreen && isOverlayOpen) {
        setIsOverlayOpen(false);
      }

      // Auto-collapse on mobile
      if (isMobileScreen && !isCollapsed) {
        setIsCollapsedState(true);
      }
    };

    // Listen for resize events (initial state already set)
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOverlayOpen, isCollapsed, setIsCollapsedState]);

  const setIsCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsedState(collapsed);
  }, [setIsCollapsedState]);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsedState(prev => !prev);
  }, [setIsCollapsedState]);

  const openOverlay = useCallback(() => {
    setIsOverlayOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  return (
    <SidebarCollapseContext.Provider
      value={{
        isCollapsed,
        isMobile,
        isOverlayOpen,
        isVisible,
        setIsCollapsed,
        setIsOverlayOpen,
        setIsVisible,
        toggleCollapsed,
        openOverlay,
        closeOverlay,
      }}
    >
      {children}
    </SidebarCollapseContext.Provider>
  );
};
