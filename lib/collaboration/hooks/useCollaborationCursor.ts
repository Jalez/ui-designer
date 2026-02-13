"use client";

import { useCallback, useRef, useState } from "react";
import { CanvasCursor } from "../types";
import { CURSOR_THROTTLE_MS } from "../constants";
import { generateUserColor } from "../utils";

interface UseCollaborationCursorOptions {
  sendCursor: (x: number, y: number) => void;
  onRemoteCursor?: (cursor: CanvasCursor) => void;
}

interface UseCollaborationCursorReturn {
  localCursor: { x: number; y: number } | null;
  remoteCursors: Map<string, CanvasCursor>;
  updateLocalCursor: (x: number, y: number) => void;
  addRemoteCursor: (cursor: CanvasCursor) => void;
  removeRemoteCursor: (clientId: string) => void;
  clearRemoteCursors: () => void;
}

export function useCollaborationCursor(
  options: UseCollaborationCursorOptions
): UseCollaborationCursorReturn {
  const { sendCursor, onRemoteCursor } = options;

  const [localCursor, setLocalCursor] = useState<{ x: number; y: number } | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, CanvasCursor>>(new Map());

  const lastSentRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateLocalCursor = useCallback(
    (x: number, y: number) => {
      setLocalCursor({ x, y });

      if (throttleTimeoutRef.current) {
        return;
      }

      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null;
      }, CURSOR_THROTTLE_MS);

      if (
        Math.abs(x - lastSentRef.current.x) > 1 ||
        Math.abs(y - lastSentRef.current.y) > 1
      ) {
        lastSentRef.current = { x, y };
        sendCursor(x, y);
      }
    },
    [sendCursor]
  );

  const addRemoteCursor = useCallback(
    (cursor: CanvasCursor) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(cursor.clientId, {
          ...cursor,
          color: cursor.color || generateUserColor(cursor.userId || cursor.clientId),
        });
        return next;
      });
      onRemoteCursor?.(cursor);
    },
    [onRemoteCursor]
  );

  const removeRemoteCursor = useCallback((clientId: string) => {
    setRemoteCursors((prev) => {
      const next = new Map(prev);
      next.delete(clientId);
      return next;
    });
  }, []);

  const clearRemoteCursors = useCallback(() => {
    setRemoteCursors(new Map());
  }, []);

  return {
    localCursor,
    remoteCursors,
    updateLocalCursor,
    addRemoteCursor,
    removeRemoteCursor,
    clearRemoteCursors,
  };
}
