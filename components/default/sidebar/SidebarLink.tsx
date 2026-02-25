import Link from "next/link";
import type React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick?: () => void;
  isActive?: boolean;
  isCollapsed: boolean;
  title?: string;
  href: string;
}

export const SidebarLink: React.FC<SidebarItemProps> = ({
  icon,
  label,
  description,
  onClick,
  isActive = false,
  isCollapsed,
  title,
  href,
}) => {
  const handleClick = (e: React.MouseEvent) => {
    // Only call onClick if it's defined - don't interfere with Link navigation
    // Don't stop propagation to allow Next.js Link to handle navigation properly
    if (onClick) {
      onClick();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onClick={handleClick}
          className={`flex h-12 p-4 rounded-none text-left w-full items-center ${isActive
            ? "text-gray-900 dark:text-white bg-gray-200 dark:bg-muted"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted"
            }`}
        >
          <div className="flex items-center justify-center w-8 shrink-0">{icon}</div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0 pl-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm whitespace-nowrap">{label}</span>
              </div>
              {description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">{description}</p>
              )}
            </div>
          )}
        </Link>
      </TooltipTrigger>
      {isCollapsed && title && (
        <TooltipContent side="right" className="ml-2">
          <p>{title}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
};
