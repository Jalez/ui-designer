/** @format */
"use client";

import type { FrameJsError } from "./Frame";

type FrameJsErrorOverlayProps = {
  error: FrameJsError | null;
  width: number;
  height: number;
};

/**
 * Shows a JS error overlay on top of a static artboard image.
 * This mirrors the inline error overlay rendered inside the drawboard iframe,
 * but is visible even when the iframe is hidden behind a static snapshot.
 */
export const FrameJsErrorOverlay = ({
  error,
  width,
  height,
}: FrameJsErrorOverlayProps): React.ReactNode => {
  if (!error) {
    return null;
  }

  return (
    <div
      role="alert"
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
      style={{
        width,
        height,
        backgroundColor: "rgba(255, 0, 0, 0.5)",
      }}
    >
      <h2 className="mb-2 text-lg font-bold text-white">
        Oops! Something went wrong :(
      </h2>
      <pre className="max-w-full whitespace-pre-wrap break-words px-4 text-center text-sm font-bold text-white">
        {error.message}
      </pre>
      {error.lineno > 0 && error.colno > 0 && (
        <pre className="mt-1 text-xs text-white/80">
          Line number: {error.lineno}, column number: {error.colno}
        </pre>
      )}
    </div>
  );
};
