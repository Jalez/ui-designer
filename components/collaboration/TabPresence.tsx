"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { ActiveUser } from "@/lib/collaboration/types";

interface TabPresenceProps {
  users: ActiveUser[];
  maxVisible?: number;
  size?: "sm" | "md";
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TabPresence({ users, maxVisible = 3, size = "md", className }: TabPresenceProps) {
  if (users.length === 0) {
    return null;
  }

  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;
  const avatarSize = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex items-center -space-x-1.5", className)}>
        {visibleUsers.map((user) => {
          const initials = getInitials(user.userName || user.userEmail);
          const isTyping = user.isTyping;

          return (
            <Tooltip key={user.clientId}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar
                    className={cn(
                      avatarSize,
                      "border border-background transition-transform hover:scale-110 hover:z-10",
                      isTyping && "animate-pulse"
                    )}
                    style={{ borderColor: user.color || undefined }}
                  >
                    {user.userImage && (
                      <AvatarImage src={user.userImage} alt={user.userName || ""} />
                    )}
                    <AvatarFallback
                      className={cn(textSize, "font-medium")}
                      style={{ backgroundColor: user.color || undefined, color: "white" }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <span className="font-medium">{user.userName || user.userEmail}</span>
                {isTyping && <span className="ml-1 text-muted-foreground">typing...</span>}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {remainingCount > 0 && (
          <Avatar className={cn(avatarSize, "border border-background")}>
            <AvatarFallback className={cn(textSize, "bg-muted font-medium")}>
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </TooltipProvider>
  );
}
