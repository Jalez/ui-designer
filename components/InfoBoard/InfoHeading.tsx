/** @format */
'use client';

import { secondaryColor } from "@/constants";
import { cn } from "@/lib/utils/cn";

interface InfoHeadingProps {
  children: React.ReactNode;
  variant: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const variantClasses = {
  h1: "text-4xl font-bold",
  h2: "text-3xl font-semibold",
  h3: "text-2xl font-semibold",
  h4: "text-xl font-semibold",
  h5: "text-lg font-semibold",
  h6: "text-base font-semibold",
};

/**
 * @description InfoHeading is a component that displays a heading for the InfoBoard
 * @param {InfoHeadingProps} props - props for component,
 * @returns {React.ReactNode}
 */
export const InfoHeading = ({ children, variant }: InfoHeadingProps) => {
  const Component = variant;

  return (
    <div className="flex justify-center relative">
      <Component
        className={cn(
          variantClasses[variant],
          "bg-secondary select-none box-border border-b-[3px] border-l-[3px] border-r-[3px] border-[#111] p-[0.25em] rounded-bl-[0.3em] rounded-br-[0.3em] z-[2]"
        )}
        style={{ backgroundColor: secondaryColor }}
      >
        {children}
      </Component>
    </div>
  );
};
