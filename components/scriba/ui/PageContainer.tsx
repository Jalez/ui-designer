"use client";

import type React from "react";

interface PageContainerProps {
  /**
   * The content to render inside the container
   */
  children: React.ReactNode;

  /**
   * The maximum width of the container
   * @default "7xl"
   */
  maxWidth?: "4xl" | "5xl" | "6xl" | "7xl" | "full";

  /**
   * Whether to use full screen height
   * @default true
   */
  fullHeight?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Standardized page container component for consistent layout across the app
 */
export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  maxWidth = "7xl",
  fullHeight = true,
  className = "",
}) => {
  const maxWidthClass = {
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full",
  }[maxWidth];

  const heightClass = fullHeight ? "min-h-screen" : "";

  return (
    <div className={`${heightClass} py-8 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className={`${maxWidthClass} mx-auto`}>{children}</div>
    </div>
  );
};
