'use client';

import { cn } from "@/lib/utils/cn";

interface SlideContainerProps {
  opacity: number;
  background: string;
  zIndex: number;
  children?: React.ReactNode;
  hidden?: boolean;
  onMouseMove?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  onMouseUp?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
}

const SlideContainer = ({
  opacity,
  background,
  zIndex,
  children,
  hidden,
  onMouseMove,
  onMouseLeave,
  onMouseUp,
}: SlideContainerProps) => {
  return (
    <div
      className={cn(
        "absolute m-0 p-0 top-0 left-0 w-full h-full overflow-hidden cursor-col-resize",
        hidden && "hidden"
      )}
      style={{
        opacity,
        background: 'yellow',
        zIndex,
      }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
    >
      {children}
    </div>
  );
};

export default SlideContainer;
