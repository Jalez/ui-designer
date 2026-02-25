'use client';

import { useState, useEffect, useRef, ReactNode } from "react";

type ScenarioHoverContainerProps = {
  children: ReactNode;
  onShowChange?: (show: boolean) => void;
};

export const ScenarioHoverContainer = ({
  children,
  onShowChange,
}: ScenarioHoverContainerProps) => {
  const [showContent, setShowContent] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = wrapperRef.current?.parentElement;
    if (!parent) return;

    const handleMouseEnter = () => {
      setShowContent(true);
      onShowChange?.(true);
    };
    
    const handleMouseLeave = (e: MouseEvent) => {
      // Don't hide if mouse is leaving to the content itself
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest('[data-scenario-hover-content]')) {
        return;
      }
      // Don't hide if mouse is still within the parent container
      if (relatedTarget && parent.contains(relatedTarget)) {
        return;
      }
      setShowContent(false);
      onShowChange?.(false);
    };

    parent.addEventListener('mouseenter', handleMouseEnter);
    parent.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      parent.removeEventListener('mouseenter', handleMouseEnter);
      parent.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [onShowChange]);

  return (
    <div ref={wrapperRef} data-scenario-hover-wrapper className="absolute inset-0 pointer-events-none z-50">
      {showContent && (
        <div data-scenario-hover-content className="pointer-events-auto h-full w-full">
          {children}
        </div>
      )}
    </div>
  );
};
