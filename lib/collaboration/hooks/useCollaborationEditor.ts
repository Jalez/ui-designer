"use client";

import { useCallback, useRef } from "react";
import { EditorType } from "../types";

interface UseCollaborationEditorOptions {
  sendCursor: (editorType: EditorType, selection: { from: number; to: number }) => void;
  sendChange: (editorType: EditorType, version: number, changes: unknown[]) => void;
}

interface UseCollaborationEditorReturn {
  updateLocalSelection: (editorType: EditorType, selection: { from: number; to: number }) => void;
  applyLocalChange: (editorType: EditorType, changes: unknown[]) => void;
}

export function useCollaborationEditor(
  options: UseCollaborationEditorOptions
): UseCollaborationEditorReturn {
  const { sendCursor, sendChange } = options;

  const versionRef = useRef<Record<EditorType, number>>({
    html: 0,
    css: 0,
    js: 0,
  });

  const lastSelectionRef = useRef<Record<EditorType, { from: number; to: number }>>({
    html: { from: 0, to: 0 },
    css: { from: 0, to: 0 },
    js: { from: 0, to: 0 },
  });

  const updateLocalSelection = useCallback(
    (editorType: EditorType, selection: { from: number; to: number }) => {
      const lastSelection = lastSelectionRef.current[editorType];
      if (
        lastSelection.from !== selection.from ||
        lastSelection.to !== selection.to
      ) {
        lastSelectionRef.current[editorType] = selection;
        sendCursor(editorType, selection);
      }
    },
    [sendCursor]
  );

  const applyLocalChange = useCallback(
    (editorType: EditorType, changes: unknown[]) => {
      const version = (versionRef.current[editorType] || 0) + 1;
      versionRef.current[editorType] = version;
      sendChange(editorType, version, changes);
    },
    [sendChange]
  );

  return {
    updateLocalSelection,
    applyLocalChange,
  };
}
