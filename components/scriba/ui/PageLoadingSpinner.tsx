import type React from "react";

interface PageLoadingSpinnerProps {
  text?: string;
  fullPage?: boolean;
}

export const PageLoadingSpinner: React.FC<PageLoadingSpinnerProps> = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
  </div>
);
