"use client";

import { Loader2 } from "lucide-react";
import type React from "react";
import { cn } from "@/lib/utils";

interface PageLoadingSpinnerProps {
  text?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  fullPage?: boolean;
}

export const PageLoadingSpinner: React.FC<PageLoadingSpinnerProps> = ({
  text = "Loading...",
  size = "lg",
  className,
  fullPage = true,
}) => {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const containerClasses = fullPage
    ? "fixed inset-0 bg-white dark:bg-gray-900 z-40 flex items-center justify-center"
    : "flex items-center justify-center py-16";

  const contentClasses = fullPage
    ? "bg-white dark:bg-gray-900 rounded-lg p-8 shadow-xl border border-gray-200 dark:border-gray-700"
    : "";

  return (
    <div className={cn(containerClasses, className)}>
      <div className={cn("flex flex-col items-center gap-4", contentClasses)}>
        <Loader2 className={cn("animate-spin text-gray-900 dark:text-gray-100", sizeClasses[size])} />
        <p className="text-gray-700 dark:text-gray-300 font-medium text-center">{text}</p>
      </div>
    </div>
  );
};
