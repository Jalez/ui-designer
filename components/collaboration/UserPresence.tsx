"use client";

import React from "react";
import { useCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface UserPresenceProps {
  className?: string;
  maxVisible?: number;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function UserPresence({ className, maxVisible = 5 }: UserPresenceProps) {
  const { activeUsers, isConnected } = useCollaboration();

  if (!isConnected || activeUsers.length === 0) {
    return null;
  }

  const visibleUsers = activeUsers.slice(0, maxVisible);
  const remainingCount = activeUsers.length - maxVisible;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => {
          const initials = getInitials(user.userName || user.userEmail);
          return (
            <Avatar
              key={user.clientId}
              className="h-8 w-8 border-2 border-background"
              style={{ borderColor: user.color || undefined }}
            >
              {user.userImage && <AvatarImage src={user.userImage} alt={user.userName || ""} />}
              <AvatarFallback
                className="text-xs font-medium"
                style={{ backgroundColor: user.color || undefined, color: "white" }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
          );
        })}
        {remainingCount > 0 && (
          <Avatar className="h-8 w-8 border-2 border-background">
            <AvatarFallback className="bg-muted text-xs font-medium">
              +{remainingCount}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <Badge variant="secondary" className="text-xs">
        {activeUsers.length} {activeUsers.length === 1 ? "user" : "users"}
      </Badge>
    </div>
  );
}
