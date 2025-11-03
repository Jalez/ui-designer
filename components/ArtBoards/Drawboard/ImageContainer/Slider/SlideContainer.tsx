'use client';

import { cn } from "@/lib/utils/cn";

interface SlideContainerProps {
  opacity: number;
  background: string;
  zIndex: number;
  children?: React.ReactNode;
  hidden?: boolean;
}

const SlideContainer = ({
  opacity,
  background,
  zIndex,
  children,
  hidden,
}: SlideContainerProps) => {
  return (
    <div
      className={cn(
        "absolute m-0 p-0 top-0 left-0 w-full h-full overflow-hidden cursor-col-resize",
        hidden && "hidden"
      )}
      style={{
        opacity,
        background,
        zIndex,
      }}
    >
      {children}
    </div>
  );
};

export default SlideContainer;
