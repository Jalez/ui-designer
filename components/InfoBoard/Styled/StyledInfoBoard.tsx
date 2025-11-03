'use client';

import { cn } from "@/lib/utils/cn";

export const StyledInfoBoard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("text-primary h-fit w-full box-border", className)}>
      {children}
    </div>
  );
};
