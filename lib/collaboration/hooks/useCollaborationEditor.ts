"use client";

import { useCallback, useRef, useState } from "react";
import { EditorChange, EditorCursor, EditorType } from "../types";
import { generateUserColor } from "../utils";

interface UseCollaborationEditorOptions {
  sendCursor: (editorType: EditorType, selection: { from: number; to: number }) => void;
  sendChange: (editorType: EditorType, version: number, changes: unknown[]) => void;
  onRemoteCursor?: (cursor: EditorCursor) => void;
  onRemoteChange?: (change: EditorChange) => void;
}

interface EditorState {
  version: number;
  pendingChanges: unknown[];
}

interface UseCollaborationEditorReturn {
  editorStates: Record<EditorType, EditorState>;
  remoteCursors: Map<string, EditorCursor>;
  updateLocalSelection: (editorType: EditorType, selection: { from: number; to: number }) => void;
  applyLocalChange: (editorType: EditorType, changes: unknown[]) => void;
  addRemoteCursor: (cursor: EditorCursor) => void;
  removeRemoteCursor: (clientId: string) => void;
  handleRemoteChange: (change: EditorChange) => { accepted: boolean; changes?: unknown[] };
}

export function useCollaborationEditor(
  options: UseCollaborationEditorOptions
): UseCollaborationEditorReturn {
  const { sendCursor, sendChange, onRemoteCursor, onRemoteChange } = options;

  const [editorStates, setEditorStates] = useState<Record<EditorType, EditorState>>({
    html: { version: 0, pendingChanges: [] },
    css: { version: 0, pendingChanges: [] },
    js: { version: 0, pendingChanges: [] },
  });

  const [remoteCursors, setRemoteCursors] = useState<Map<string, EditorCursor>>(new Map());

  const lastSelectionRef = useRef<{ from: number; to: number }>({ from: 0, to: 0 });

  const updateLocalSelection = useCallback(
    (editorType: EditorType, selection: { from: number; to: number }) => {
      if (
        lastSelectionRef.current.from !== selection.from ||
        lastSelectionRef.current.to !== selection.to
      ) {
        lastSelectionRef.current = selection;
        sendCursor(editorType, selection);
      }
    },
    [sendCursor]
  );

  const applyLocalChange = useCallback(
    (editorType: EditorType, changes: unknown[]) => {
      setEditorStates((prev) => {
        const newState = {
          ...prev[editorType],
          version: prev[editorType].version + 1,
          pendingChanges: [...prev[editorType].pendingChanges, ...changes],
        };
        return { ...prev, [editorType]: newState };
      });

      const version = editorStates[editorType].version + 1;
      sendChange(editorType, version, changes);
    },
    [sendChange, editorStates]
  );

  const addRemoteCursor = useCallback(
    (cursor: EditorCursor) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(`${cursor.clientId}-${cursor.editorType}`, {
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
      for (const key of next.keys()) {
        if (key.startsWith(clientId)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  const handleRemoteChange = useCallback(
    (change: EditorChange): { accepted: boolean; changes?: unknown[] } => {
      if (change.isAck) {
        setEditorStates((prev) => ({
          ...prev,
          [change.editorType]: {
            ...prev[change.editorType],
            pendingChanges: [],
          },
        }));
        return { accepted: true, changes: [] };
      }

      const currentVersion = editorStates[change.editorType].version;

      if (change.version <= currentVersion) {
        return { accepted: false };
      }

      setEditorStates((prev) => ({
        ...prev,
        [change.editorType]: {
          version: change.version,
          pendingChanges: prev[change.editorType].pendingChanges,
        },
      }));

      onRemoteChange?.(change);

      return { accepted: true, changes: change.changes };
    },
    [editorStates, onRemoteChange]
  );

  return {
    editorStates,
    remoteCursors,
    updateLocalSelection,
    applyLocalChange,
    addRemoteCursor,
    removeRemoteCursor,
    handleRemoteChange,
  };
}
