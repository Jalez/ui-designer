/** @format */
'use client';

import { useState, useRef, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FloatingActionButtonProps {
  leftLabel: string;
  rightLabel: string;
  checked: boolean;
  onCheckedChange: () => void;
  tooltip?: string;
  showOnHover?: boolean;
  storageKey?: string; // Unique key for localStorage persistence
}

export const FloatingActionButton = ({
  leftLabel,
  rightLabel,
  checked,
  onCheckedChange,
  tooltip,
  showOnHover = true,
  storageKey,
}: FloatingActionButtonProps) => {
  const defaultPosition = { x: -16, y: 16 };

  // Helper function to get initial position (defined before useState)
  const getInitialPosition = (): { x: number; y: number } => {
    if (!storageKey || typeof window === 'undefined') return defaultPosition;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : defaultPosition;
    } catch (error) {
      console.error('Failed to load stored position:', error);
      return defaultPosition;
    }
  };

  // localStorage helpers
  const savePosition = (pos: { x: number; y: number }) => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(pos));
    } catch (error) {
      console.warn('Failed to save position:', error);
    }
  };

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(!showOnHover);
  const [dragStarted, setDragStarted] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [actualPosition, setActualPosition] = useState(() => getInitialPosition());
  const buttonRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const lastDragPosition = useRef<{ x: number; y: number } | null>(null);


  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setIsDragging(true);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !buttonRef.current) return;

    const container = buttonRef.current.parentElement;
    if (!container) return;

    // Check if mouse has moved enough to be considered a drag
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    const dragThreshold = 5; // pixels

    if (deltaX > dragThreshold || deltaY > dragThreshold) {
      if (!dragStarted) {
        setDragStarted(true);
      }
    }

    // Always move the button when dragging, even before dragStarted is set
    const containerRect = container.getBoundingClientRect();

    let newX = e.clientX - containerRect.left - dragOffset.x;
    let newY = e.clientY - containerRect.top - dragOffset.y;

    // Constrain to container bounds (leave some padding)
    const padding = 8;
    const buttonWidth = 120;
    const buttonHeight = 50;
    newX = Math.max(padding, Math.min(newX, containerRect.width - buttonWidth - padding));
    newY = Math.max(padding, Math.min(newY, containerRect.height - buttonHeight - padding));

    const newPosition = { x: newX, y: newY };
    lastDragPosition.current = newPosition;
    setActualPosition(newPosition);
  };

  const handleMouseUp = () => {
    const wasDragging = dragStarted;
    setIsDragging(false);

    // Reset drag state
    setTimeout(() => {
      setDragStarted(false);
    }, 10);

    if (wasDragging) {
      const positionToSave = lastDragPosition.current || actualPosition;
      console.log('Saving final position after drag:', positionToSave);
      // Save position to localStorage
      savePosition(positionToSave);
      // Reset the last drag position
      lastDragPosition.current = null;
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Ensure position stays within container bounds when container is available
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();

      // Constrain current position to container bounds
      const buttonWidth = 120; // approximate button width
      const buttonHeight = 50; // approximate button height
      const constrainedX = Math.max(8, Math.min(actualPosition.x, containerRect.width - buttonWidth - 8));
      const constrainedY = Math.max(8, Math.min(actualPosition.y, containerRect.height - buttonHeight - 8));

      if (constrainedX !== actualPosition.x || constrainedY !== actualPosition.y) {
        const newPosition = { x: constrainedX, y: constrainedY };
        setActualPosition(newPosition);
        savePosition(newPosition);
      }
    }
  }, [containerRef.current, actualPosition]);

  useEffect(() => {
    if (buttonRef.current) {
      containerRef.current = buttonRef.current.parentElement;
    }

    if (showOnHover && containerRef.current) {
      const handleMouseEnter = () => setIsVisible(true);
      const handleMouseLeave = () => {
        if (!isDragging) {
          setIsVisible(false);
        }
      };

      const container = containerRef.current;
      container.addEventListener('mouseenter', handleMouseEnter);
      container.addEventListener('mouseleave', handleMouseLeave);

      return () => {
        container.removeEventListener('mouseenter', handleMouseEnter);
        container.removeEventListener('mouseleave', handleMouseLeave);
      };
    } else {
      setIsVisible(true);
    }
  }, [showOnHover, isDragging]);

  const handleSwitchChange = (checked: boolean) => {
    // Don't trigger switch if user was dragging
    if (!dragStarted) {
      onCheckedChange();
    }
  };

  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Don't trigger switch if user was dragging
    if (!dragStarted) {
      onCheckedChange();
    }
  };

  return (
      <div
        ref={buttonRef}
        className={`absolute z-50 cursor-move select-none transition-opacity duration-200 ${
          isDragging ? 'cursor-grabbing' : ''
        } ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{
        left: `${actualPosition.x}px`,
        top: `${actualPosition.y}px`,
      }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
  
            <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-white/20 shadow-lg hover:bg-black/90 transition-colors">
              <div className="flex flex-row items-center gap-3">
                <Label
                  className="select-none text-sm font-medium cursor-pointer"
                  onClick={handleLabelClick}
                >
                  {leftLabel}
                </Label>
                <Switch
                  checked={checked}
                  onCheckedChange={handleSwitchChange}
                />
                <Label
                  className="select-none text-sm font-medium cursor-pointer"
                  onClick={handleLabelClick}
                >
                  {rightLabel}
                </Label>
              </div>
            </div>
   
      </div>
  );
};
