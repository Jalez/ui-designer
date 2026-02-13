"use client";

import React from "react";
import { useCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const { isConnected, isConnecting, error } = useCollaboration();

  if (error) {
    return (
      <Badge variant="destructive" className={cn("text-xs", className)}>
        Connection Error
      </Badge>
    );
  }

  if (isConnecting) {
    return (
      <Badge variant="secondary" className={cn("text-xs", className)}>
        <span className="mr-1 h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
        Connecting...
      </Badge>
    );
  }

  if (isConnected) {
    return (
      <Badge variant="default" className={cn("bg-green-600 text-xs", className)}>
        <span className="mr-1 h-2 w-2 rounded-full bg-green-300" />
        Connected
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      <span className="mr-1 h-2 w-2 rounded-full bg-gray-400" />
      Disconnected
    </Badge>
  );
}
