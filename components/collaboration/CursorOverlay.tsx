"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { RemoteCursor } from "./RemoteCursor";

interface CursorOverlayProps {
  children: React.ReactNode;
  className?: string;
}

export function CursorOverlay({ children, className }: CursorOverlayProps) {
  const { remoteCursors, updateCanvasCursor, isConnected } = useCollaboration();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const updateRect = () => {
      if (containerRef.current) {
        setRect(containerRef.current.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isConnected || !rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      updateCanvasCursor(x, y);
    },
    [isConnected, rect, updateCanvasCursor]
  );

  const handleMouseLeave = useCallback(() => {
    // Optionally hide cursor when leaving
  }, []);

  const cursorsArray = Array.from(remoteCursors.values());

  return (
    <div
      ref={containerRef}
      className={`relative ${className || ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isConnected && (
        <div className="pointer-events-none absolute inset-0 overflow-visible">
          {cursorsArray.map((cursor) => (
            <RemoteCursor key={cursor.clientId} cursor={cursor} />
          ))}
        </div>
      )}
    </div>
  );
}
