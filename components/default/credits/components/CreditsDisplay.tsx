"use client";

import { Coins, Loader2 } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useEffect, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarCollapse } from "../../../default/sidebar";
import { useCreditsStore } from "../store/creditsStore";
import { formatCredits } from "../utils/creditCalculator";

interface CreditsDisplayProps {
  className?: string;
  compact?: boolean;
}

// Hook for rolling number animation
function useRollingCounter(value: number, duration: number = 1000) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (value === displayValue) return;

    setIsAnimating(true);
    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - (1 - progress) ** 4;
      const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [value, displayValue, duration]);

  return { displayValue, isAnimating };
}

export const CreditsDisplay: React.FC<CreditsDisplayProps> = ({
  className = "flex items-center gap-2",
  compact = false,
}) => {
  const { isCollapsed } = useSidebarCollapse();
  const { credits, isLoading, hasFetchedCredits } = useCreditsStore();
  const { displayValue, isAnimating } = useRollingCounter(credits?.current || 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/subscription"
          className={
            compact
              ? `${className} p-4 rounded-md transition-all duration-200 bg-background text-foreground hover:bg-accent hover:text-accent-foreground`
              : `${className} text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted pl-4 w-full`
          }
        >
          {credits ? (
            <>
              {compact ? (
                <>
                  <Coins className="h-4 w-4" />
                  <span
                    className={`text-sm font-medium hidden sm:inline ${credits.current < 10 ? "text-red-600 dark:text-red-400" : ""}
                                            ${isAnimating ? "transition-all duration-75" : ""}`}
                  >
                    {displayValue.toLocaleString()}
                  </span>
                </>
              ) : (
                <div className="relative flex items-center justify-center h-12 w-full transition-all duration-300 ease-in-out overflow-hidden">
                  <div className="flex items-center justify-center w-full transition-all duration-300 ease-in-out">
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-1 transform  left-2" : "top-1/2 left-2 transform -translate-y-1/2"}`}
                    >
                      <Coins className="h-4 w-4 transition-all duration-300 ease-in-out" />
                    </div>
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-5 transform left-0 w-8 flex justify-center" : "top-1/2 left-10 transform -translate-y-1/2"}`}
                    >
                      <span
                        className={`text-sm font-medium whitespace-nowrap transition-all duration-300 ease-in-out ${credits.current < 10 ? "text-red-600" : "text-foreground"
                          } ${isAnimating ? "transition-all duration-75" : ""}`}
                      >
                        {isCollapsed ? formatCredits(displayValue) : `${displayValue.toLocaleString()} credits`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : !hasFetchedCredits || isLoading ? (
            <>
              {compact ? (
                <div className={`flex items-center justify-center ${compact ? "" : isCollapsed ? "" : "pl-2"}`}>
                  <Loader2 className={`animate-spin text-muted-foreground ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
                </div>
              ) : (
                <div className="relative flex items-center justify-center h-12 w-full transition-all duration-300 ease-in-out overflow-hidden">
                  <div className="flex items-center justify-center w-full transition-all duration-300 ease-in-out">
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-1 transform  left-2" : "top-1/2 left-2 transform -translate-y-1/2"}`}
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground transition-all duration-300 ease-in-out" />
                    </div>
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-5 transform left-0 w-8 flex justify-center" : "top-1/2 left-10 transform -translate-y-1/2"}`}
                    >
                      <span className="text-sm font-medium whitespace-nowrap transition-all duration-300 ease-in-out text-muted-foreground">
                        {isCollapsed ? "..." : "Loading..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : hasFetchedCredits && !isLoading ? (
            <>
              {compact ? (
                <>
                  <Coins className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground hidden sm:inline">0</span>
                </>
              ) : (
                <div className="relative flex items-center justify-center h-12 w-full transition-all duration-300 ease-in-out overflow-hidden">
                  <div className="flex items-center justify-center w-full transition-all duration-300 ease-in-out">
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-1 transform  left-2" : "top-1/2 left-2 transform -translate-y-1/2"}`}
                    >
                      <Coins className="h-4 w-4 transition-all duration-300 ease-in-out" />
                    </div>
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-5 transform left-0 w-8 flex justify-center" : "top-1/2 left-10 transform -translate-y-1/2"}`}
                    >
                      <span className="text-sm font-medium whitespace-nowrap transition-all duration-300 ease-in-out text-muted-foreground">
                        {isCollapsed ? "0" : "No credits"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            // Fallback to loading state for any other case
            <>
              {compact ? (
                <div className={`flex items-center justify-center ${compact ? "" : isCollapsed ? "" : "pl-2"}`}>
                  <Loader2 className={`animate-spin text-muted-foreground ${compact ? "h-4 w-4" : "h-5 w-5"}`} />
                </div>
              ) : (
                <div className="relative flex items-center justify-center h-12 w-full transition-all duration-300 ease-in-out overflow-hidden">
                  <div className="flex items-center justify-center w-full transition-all duration-300 ease-in-out">
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-1 transform  left-2" : "top-1/2 left-2 transform -translate-y-1/2"}`}
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground transition-all duration-300 ease-in-out" />
                    </div>
                    <div
                      className={`absolute transition-all duration-300 ease-in-out ${isCollapsed ? "top-5 transform left-0 w-8 flex justify-center" : "top-1/2 left-10 transform -translate-y-1/2"}`}
                    >
                      <span className="text-sm font-medium whitespace-nowrap transition-all duration-300 ease-in-out text-muted-foreground">
                        {isCollapsed ? "..." : "Loading..."}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Link>
      </TooltipTrigger>
      {(isCollapsed || compact) && (
        <TooltipContent side={compact ? "bottom" : "right"} className={compact ? "" : "ml-2"}>
          <p>View plans & pricing</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};
