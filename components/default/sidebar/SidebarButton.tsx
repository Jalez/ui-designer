"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarButtonProps {
  icon: React.ReactNode;
  label?: string;
  description?: string;
  isCollapsed: boolean;
  onClick: () => void;
  tooltip?: string;
  variant?: "ghost" | "default" | "destructive" | "outline" | "secondary" | "link";
  className?: string;
  disabled?: boolean;
}

export const SidebarButton: React.FC<SidebarButtonProps> = ({
  icon,
  label,
  description,
  isCollapsed,
  onClick,
  tooltip,
  variant = "ghost",
  className = "",
  disabled = false,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          onClick={onClick}
          disabled={disabled}
          className={`flex h-12 p-4 rounded-none text-left w-full justify-start items-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted ${className}`}
        >
          <div className="flex items-center justify-center w-8 shrink-0">{icon}</div>
          {!isCollapsed && label && (
            <div className="flex-1 min-w-0 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm whitespace-nowrap">{label}</span>
              </div>
              {description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">{description}</p>
              )}
            </div>
          )}
        </Button>
      </TooltipTrigger>
      {tooltip && (
        <TooltipContent side="right" className="ml-2">
          <p>{tooltip}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};
