"use client";

import React from "react";
import { CanvasCursor } from "@/lib/collaboration/types";

interface RemoteCursorProps {
  cursor: CanvasCursor;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function RemoteCursor({ cursor }: RemoteCursorProps) {
  const { x, y, color, userName } = cursor;
  const displayName = userName || "Anonymous";

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: x,
        top: y,
        transform: "translate(-1px, -1px)",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        className="drop-shadow-sm"
      >
        <path
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L5.94 2.85a.5.5 0 0 0-.44.36Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>
      <div
        className="absolute left-5 top-5 whitespace-nowrap rounded px-2 py-1 text-xs font-medium text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {displayName}
      </div>
    </div>
  );
}
