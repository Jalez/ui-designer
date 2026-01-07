"use client";

import type { Editor } from "@tiptap/core";
import { ChevronRight, Files } from "lucide-react";
import type React from "react";
import { useState } from "react";

interface RightPanelContainerProps {
  editor?: Editor;
  isMobile?: boolean;
  onClose?: () => void;
}

export const RightPanelContainer: React.FC<RightPanelContainerProps> = ({ isMobile = false, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handlePanelClick = () => {
    // Expand the panel when clicked and collapsed (only on desktop)
    if (isCollapsed && !isMobile) {
      setIsCollapsed(false);
    }
  };

  const handleCollapseClick = () => {
    if (isMobile) {
      // On mobile, collapse means close the drawer entirely
      onClose?.();
    } else {
      // On desktop, just collapse the panel
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div
      className={`h-full flex flex-col bg-background transition-all duration-300 ease-out relative group ${isMobile ? "w-96 z-[9999]" : isCollapsed ? "w-16" : "w-96 border-l border-gray-200 dark:border-gray-700"}`}
    >
      <div className="flex-1 h-full relative">
        <div className="w-full bg-background dark:border-gray-700 flex flex-col h-full justify-between ">
          {/* Header */}
          <div className="flex items-center h-12 relative w-full bg-background">
            {/* Collapse Button - Only show when not collapsed */}
            {!isCollapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCollapseClick();
                }}
                className="absolute left-4 flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={isMobile ? "Close Files Panel" : "Collapse Files Panel"}
              >
                <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            )}

            {/* Title - Only show when not collapsed */}
            {!isCollapsed && (
              <div className="flex items-center justify-end w-full pr-14">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">Files</h2>
              </div>
            )}

            {/* Icon - fixed position from right to prevent shifting */}
            <div className="absolute right-4 flex items-center justify-center w-8">
              <Files className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Invisible expand button when collapsed - matches left sidebar */}
      {isCollapsed && !isMobile && (
        <button
          type="button"
          className="absolute inset-0 w-full h-full bg-transparent p-0 cursor-expand-panel"
          onClick={(e) => {
            e.stopPropagation();
            handlePanelClick();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              handlePanelClick();
            }
          }}
          tabIndex={-1}
          aria-label="Expand files panel"
        />
      )}
    </div>
  );
};
