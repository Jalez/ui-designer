"use client";

import { ChevronUp, Loader2, LogIn, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
// import { useSubscriptionStore } from "../subscription/stores";
import { useSidebarCollapse } from ".";
import { UserDropdownContent } from "./UserDropdownContent";

// Stub for subscription store until subscription system is fully integrated
const useSubscriptionStore = () => ({ subscription: null });



export const UserProfileMenu: React.FC = () => {
  const { isCollapsed } = useSidebarCollapse();
  const { data: session, status } = useSession();
  const { subscription } = useSubscriptionStore();
  const isAuthenticated = () => !!session?.user;
  const isGuest = () => !session?.user;
  const getUserEmail = () => session?.user?.email || "";
  const getUserName = () => session?.user?.name || session?.user?.email || "";

  const router = useRouter();
  const isLoading = status === "loading";

  const handleSignIn = () => {
    // Redirect to the dedicated sign-in page with current URL as callback
    const currentUrl = window.location.pathname + window.location.search;
    const callbackUrl = encodeURIComponent(currentUrl);
    router.push(`/auth/signin?callbackUrl=${callbackUrl}`);
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: "/" });
  };

  // Determine avatar content and styling
  let avatarContent: React.ReactNode;

  if (isLoading) {
    avatarContent = <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />;
  } else if (!isAuthenticated()) {
    avatarContent = <LogIn className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
  } else {
    avatarContent = <User className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
  }

  return (
    <>
      {isGuest() ? (
        // For guests, show sign in button with tooltip
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={handleSignIn}
              className={`flex h-12 p-4 rounded-none text-left w-full items-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0`}
            >
              <div className="flex items-center justify-center w-8 shrink-0">{avatarContent}</div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 pl-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm whitespace-nowrap">Sign In</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">Access your account</p>
                </div>
              )}
            </Button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="ml-2">
              <p>Sign In</p>
            </TooltipContent>
          )}
        </Tooltip>
      ) : (
        <Tooltip>
          <DropdownMenu>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`flex h-12 p-4 rounded-none text-left w-full justify-start items-center text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-muted focus-visible:ring-0 focus-visible:ring-offset-0`}
                >
                  <div className="flex items-center justify-center w-8 shrink-0">{avatarContent}</div>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 pl-3">
                      <div className="flex items-center gap-2 justify-between">
                        <span className="font-medium text-sm whitespace-nowrap truncate">
                          {getUserName() || getUserEmail()}
                        </span>
                        <ChevronUp className="h-4 w-4 text-gray-500 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap truncate">
                        {subscription?.planName}
                      </p>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <UserDropdownContent getUserName={getUserName} handleSignOut={handleSignOut} />
            {isCollapsed && (
              <TooltipContent side="right" className="ml-2 ">
                <p>Profile</p>
              </TooltipContent>
            )}
          </DropdownMenu>
        </Tooltip>
      )}
    </>
  );
};
