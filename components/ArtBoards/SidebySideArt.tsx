'use client';

import { cloneElement, isValidElement, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SingleLayoutControl = {
  label: "Solution" | "Drawboard";
  onClick: () => void;
};

type SidebySideArtProps = {
  contents: ReactNode[];
  onSingleLayoutControlChange?: (control: SingleLayoutControl | null) => void;
};

type LayoutMode = "row" | "column" | "single";

const BOARD_BORDER_CHROME = 10;
const BOARD_VERTICAL_CHROME = 20;
const LAYOUT_GAP = 16;
const LAYOUT_PADDING_X = 16;
const LAYOUT_PADDING_Y = 16;
const SINGLE_LAYOUT_CONTROLS_HEIGHT = 56;

function getScenarioDimensions(content: ReactNode): { width: number; height: number } | null {
  if (!isValidElement<{ scenario?: { dimensions?: { width?: number; height?: number } } }>(content)) {
    return null;
  }

  const width = content.props.scenario?.dimensions?.width;
  const height = content.props.scenario?.dimensions?.height;
  if (typeof width !== "number" || typeof height !== "number") {
    return null;
  }

  return {
    width: width + BOARD_BORDER_CHROME,
    height: height + BOARD_VERTICAL_CHROME,
  };
}

const withScalingPreference = (
  content: ReactNode,
  opts: {
    allowScaling: boolean;
    registerForNavbarCapture: boolean;
    suppressHeavyLayoutEffects: boolean;
  },
) => {
  if (
    !isValidElement<{
      allowScaling?: boolean;
      registerForNavbarCapture?: boolean;
      suppressHeavyLayoutEffects?: boolean;
    }>(content)
  ) {
    return content;
  }

  return cloneElement(content, {
    allowScaling: opts.allowScaling,
    registerForNavbarCapture: opts.registerForNavbarCapture,
    suppressHeavyLayoutEffects: opts.suppressHeavyLayoutEffects,
  });
};

const SidebySideArt = ({ contents, onSingleLayoutControlChange }: SidebySideArtProps): ReactNode => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("row");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const maxIndex = Math.max(contents.length - 1, 0);
  const visibleIndex = Math.min(activeIndex, maxIndex);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const dimensions = contents.map(getScenarioDimensions);
    const canMeasureAllBoards = dimensions.every((value) => value !== null);

    const updateLayoutMode = () => {
      if (!canMeasureAllBoards) {
        setLayoutMode("row");
        return;
      }

      const sizes = dimensions as { width: number; height: number }[];
      const availableWidth = Math.max(0, container.clientWidth - LAYOUT_PADDING_X);
      const availableHeight = Math.max(0, container.clientHeight - LAYOUT_PADDING_Y);

      const totalRowWidth =
        sizes.reduce((sum, size) => sum + size.width, 0) + LAYOUT_GAP * Math.max(0, sizes.length - 1);
      const maxRowHeight = sizes.reduce((max, size) => Math.max(max, size.height), 0);

      const totalColumnHeight =
        sizes.reduce((sum, size) => sum + size.height, 0) + LAYOUT_GAP * Math.max(0, sizes.length - 1);
      const maxColumnWidth = sizes.reduce((max, size) => Math.max(max, size.width), 0);

      const rowFits = totalRowWidth <= availableWidth && maxRowHeight <= availableHeight;
      const columnFits =
        maxColumnWidth <= availableWidth
        && totalColumnHeight <= Math.max(0, availableHeight - SINGLE_LAYOUT_CONTROLS_HEIGHT);

      setLayoutMode(rowFits ? "row" : columnFits ? "column" : "single");
    };

    updateLayoutMode();

    let frameId: number | null = null;
    const observer = new ResizeObserver(() => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        updateLayoutMode();
      });
    });

    observer.observe(container);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
    };
  }, [contents]);

  const goPrevious = useCallback(() => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((current) => Math.min(current + 1, contents.length - 1));
  }, [contents.length]);

  const singleLayoutTarget = useMemo(
    () => (
      visibleIndex === 0
        ? { label: "Drawboard" as const, onClick: goNext, disabled: visibleIndex >= maxIndex }
        : { label: "Solution" as const, onClick: goPrevious, disabled: visibleIndex <= 0 }
    ),
    [goNext, goPrevious, maxIndex, visibleIndex],
  );

  useEffect(() => {
    if (!onSingleLayoutControlChange) {
      return;
    }

    if (layoutMode !== "single" || contents.length <= 1 || singleLayoutTarget.disabled) {
      onSingleLayoutControlChange(null);
      return;
    }

    onSingleLayoutControlChange({
      label: singleLayoutTarget.label,
      onClick: singleLayoutTarget.onClick,
    });

    return () => onSingleLayoutControlChange(null);
  }, [contents.length, layoutMode, onSingleLayoutControlChange, singleLayoutTarget.disabled, singleLayoutTarget.label, singleLayoutTarget.onClick]);

  const renderRowOrColumn = (direction: "row" | "column") => (
    <div
      className={`flex h-full w-full min-h-0 items-stretch justify-center gap-4 px-2 py-2 ${
        direction === "row" ? "flex-row" : "flex-col"
      }`}
    >
      {contents.map((content, index) => (
        <div
          key={`sidebyside-${direction}-${index}`}
          className={
            direction === "row"
              ? "flex min-w-0 flex-1 items-start justify-center"
              : "flex min-h-0 w-full flex-1 items-start justify-center"
          }
        >
          {withScalingPreference(content, {
            allowScaling: false,
            registerForNavbarCapture: true,
            suppressHeavyLayoutEffects: false,
          })}
        </div>
      ))}
    </div>
  );

  const renderSingle = () => (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-start gap-3">
      <div className="relative flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden">
        {contents.map((content, index) => (
          <div
            key={`mobile-sidebyside-${index}`}
            className={
              `absolute inset-0 flex min-h-0 items-center justify-center transition-opacity duration-300 ease-out ${
                index === visibleIndex ? "opacity-100" : "pointer-events-none opacity-0"
              }`
            }
            aria-hidden={index !== visibleIndex}
          >
            {withScalingPreference(content, {
              allowScaling: true,
              registerForNavbarCapture: index === visibleIndex,
              // Keep both artboards mounted in the same viewport slot. Moving the
              // hidden board off-screen breaks drawboard capture/comparison more
              // easily than simply hiding it visually in place.
              suppressHeavyLayoutEffects: false,
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full min-h-0 flex-col items-center justify-center gap-3"
    >
      {layoutMode === "single"
        ? renderSingle()
        : layoutMode === "column"
          ? renderRowOrColumn("column")
          : renderRowOrColumn("row")}
    </div>
  );
};

export default SidebySideArt;
