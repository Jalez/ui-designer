'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";

type PoppingTitleProps = {
  topTitle?: string;
  bottomTitle?: string;
  children: React.ReactNode;
  topLocation?: string;
};

const PoppingTitle = ({
  children,
  topTitle,
  topLocation = "top",
  bottomTitle,
}: PoppingTitleProps) => {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleHover = () => {
    setOpen(true);
  };

  // Radix Tooltip can only show one TooltipContent, so combine both titles if they exist
  const displayTitle = topTitle && bottomTitle 
    ? `${topTitle}\n${bottomTitle}` 
    : (topTitle || bottomTitle);
  const displaySide = topTitle ? (topLocation as any) : "bottom";

  return (
    <TooltipProvider>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <div onMouseEnter={handleHover} onMouseLeave={handleClose}>
            {children}
          </div>
        </TooltipTrigger>
        {displayTitle && (
          <TooltipContent
            side={displaySide}
            className="bg-secondary text-secondary-foreground"
            style={{
              backgroundColor: 'hsl(var(--secondary))',
              color: 'hsl(var(--secondary-foreground))',
            }}
          >
            {displayTitle}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

export default PoppingTitle;
