import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import { yCollab } from "y-codemirror.next";

import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";
import { logCollaborationStep } from "@/lib/collaboration/logCollaborationStep";
import type { EditorType } from "@/lib/collaboration/types";

import { TYPING_IDLE_MS } from "./constants";
import { useEditorTypingPresence } from "./useEditorTypingPresence";
import { useRemoteCarets } from "./useRemoteCarets";
import { EMPTY_EDITOR_CURSORS, titleToEditorType } from "./utils";

interface UseYjsCodeEditorCollaborationOptions {
  title: "HTML" | "CSS" | "JS";
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  template: string;
  enabled?: boolean;
  docKind?: "template" | "solution";
  locked: boolean;
  levelIdentifier: string;
  currentLevel: number;
  onLocalChange?: () => void;
  onLocalUserInput?: () => void;
}

/**
 * COLLABORATION STEP 3.6:
 * This hook is where each code editor plugs into the shared collaboration engine.
 * In plain terms, it ties one visible editor tab to one shared Yjs text document,
 * keeps React state in sync with that shared text, and publishes presence like
 * cursor position and typing state while the user edits.
 */
export function useYjsCodeEditorCollaboration({
  title,
  code,
  setCode,
  enabled = true,
  docKind = "template",
  locked,
  levelIdentifier,
  currentLevel,
  onLocalChange,
  onLocalUserInput,
}: UseYjsCodeEditorCollaborationOptions) {
  logCollaborationStep("3.6", "useYjsCodeEditorCollaboration", {
    title,
    levelIdentifier,
    currentLevel,
    enabled,
    locked,
  });
  const collaboration = useOptionalCollaboration();
  const isConnected = enabled && (collaboration?.isConnected ?? false);
  const yjsReady = collaboration?.yjsReady === true;
  const setTyping = collaboration?.setTyping;
  const updateEditorSelection = collaboration?.updateEditorSelection;
  const editorCursors = enabled ? (collaboration?.editorCursors ?? EMPTY_EDITOR_CURSORS) : EMPTY_EDITOR_CURSORS;
  const getYText = collaboration?.getYText;
  const getYSolutionText = collaboration?.getYSolutionText;
  const reportEditorWatchState = collaboration?.reportEditorWatchState;
  const editorType: EditorType = titleToEditorType(title);
  const levelIndex = currentLevel - 1;
  const yjsDocGeneration = collaboration?.yjsDocGeneration ?? 0;
  const yText = enabled
    ? (docKind === "solution"
      ? (getYSolutionText?.(editorType, levelIndex) ?? null)
      : (getYText?.(editorType, levelIndex) ?? null))
    : null;

  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewportRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeRef = useRef(code);
  const applyingExternalUpdateRef = useRef(false);
  const lastObservedYTextValueRef = useRef<string | null>(null);
  const codeUpdateOriginRef = useRef<"editor" | "yjs" | null>(null);
  const initialSyncKeyRef = useRef<string | null>(null);

  const editorKey = `${levelIdentifier}:${docKind}:${editorType}:${levelIndex}`;
  const [editorMountValue] = useState(() => {
    // IMPORTANT: Keep the Yjs editor doc empty until yjsReady.
    // Visual fallbacks are handled outside the Yjs surface to avoid accidentally
    // pushing local content into the shared Y.Text during handshake/reconnect.
    return "";
  });

  const editorExtensions = useMemo<Extension[]>(() => {
    if (!enabled || !yText || !yjsReady) {
      return [];
    }
    return [yCollab(yText, null, { undoManager: false })];
  }, [enabled, yText, yjsReady]);

  const editorInitialState = useMemo(() => {
    const doc = enabled && yText && yjsReady ? yText.toString() : editorMountValue;
    return {
      json: EditorState.create({
        doc,
      }).toJSON(),
    };
  }, [editorMountValue, enabled, yText, yjsReady]);

  useEffect(() => {
    if (lastObservedYTextValueRef.current == null) {
      lastObservedYTextValueRef.current = editorMountValue;
    }
  }, [editorMountValue, editorType, levelIndex]);

  const { typingTimeoutRef: typingPresenceTimeoutRef, handleTypingStart, handleTypingEnd } = useEditorTypingPresence({
    isConnected,
    locked,
    setTyping,
    editorType,
    levelIndex,
    title,
  });

  useEffect(() => {
    typingTimeoutRef.current = typingPresenceTimeoutRef.current;
  }, [typingPresenceTimeoutRef]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!isConnected || !yText || !yjsReady) {
      return;
    }

    /**
     * COLLABORATION STEP 14.2:
     * When the shared Yjs text changes, this helper copies that canonical value
     * back into local React state so the rest of the app sees the exact same code.
     * This is the "make the screen reflect the shared document" step.
     */
    const syncReactCode = (nextValue: string, markExternal = false, origin: string = "yjs") => {
      console.log(`[collab-loop] syncReactCode editor=${editorType} level=${levelIndex} origin=${origin} len=${nextValue.length}`);
      logCollaborationStep("14.2", "syncReactCode", {
        editorType,
        levelIndex,
        origin,
        markExternal,
        nextLength: nextValue.length,
      });
      lastObservedYTextValueRef.current = nextValue;
      codeRef.current = nextValue;
      codeUpdateOriginRef.current = "yjs";
      setCode((prev) => (prev === nextValue ? prev : nextValue));
      reportEditorWatchState?.({
        editorType,
        levelIndex,
        content: nextValue,
        version: null,
        isEditable: !locked,
        isFocused: editorViewRef.current?.hasFocus ?? false,
        isTyping: false,
        source: origin === "initial" ? "room_sync" : "remote_apply",
      });
      if (markExternal) {
        applyingExternalUpdateRef.current = true;
        queueMicrotask(() => {
          applyingExternalUpdateRef.current = false;
        });
      }
    };

    const initialSyncKey = `${editorKey}:g${yjsDocGeneration}`;
    if (initialSyncKeyRef.current !== initialSyncKey) {
      initialSyncKeyRef.current = initialSyncKey;
      syncReactCode(yText.toString(), false, "initial");
    }

    /**
     * COLLABORATION STEP 13.2:
     * This observer listens to Yjs itself. Any local or remote CRDT change ends up
     * here, so this is the moment where the shared document announces "the source
     * of truth changed" and the UI starts reconciling to match it.
     */
    const observer = (event: { target: { toString(): string } }, transaction: { origin: unknown }) => {
      logCollaborationStep("13.2", "yText observer", {
        editorType,
        levelIndex,
        transactionOrigin: String(transaction.origin),
      });
      const nextValue = event.target.toString();
      if (transaction.origin === "external-code-state") {
        syncReactCode(nextValue, false, "external-code-state");
        return;
      }
      syncReactCode(nextValue, true, String(transaction.origin));
    };

    yText.observe(observer);
    return () => {
      yText.unobserve(observer);
    };
  }, [editorKey, editorType, enabled, isConnected, levelIdentifier, levelIndex, locked, reportEditorWatchState, setCode, yText, yjsDocGeneration, yjsReady]);

  useEffect(() => {
    codeRef.current = code;
    if (codeUpdateOriginRef.current) {
      codeUpdateOriginRef.current = null;
    }
  }, [code]);

  const { remoteCarets } = useRemoteCarets({
    editorViewRef,
    editorViewportRef,
    editorCursors,
    editorType,
    levelIndex,
    isConnected,
    code,
  });

  /**
   * COLLABORATION STEP 4.1:
   * In the old patch-based flow this would manually ship text changes. In Yjs mode
   * it intentionally does nothing because CodeMirror writes directly into the shared
   * Yjs text, so the shared document is already being updated at the source.
   */
  const handleCodeUpdate = useCallback(() => {
    logCollaborationStep("4.1", "handleCodeUpdate", {
      editorType,
      levelIndex,
      isYjsManaged: true,
    });
    // Yjs-managed editors use CodeMirror updates as the source of truth.
  }, [editorType, levelIndex]);

  /**
   * COLLABORATION STEP 4.2:
   * Every editor update passes through here. It sends the latest selection into
   * awareness, mirrors changed code into React state, marks whether the change came
   * from real user typing, and starts/stops typing presence so collaborators can
   * see where active work is happening.
   */
  const handleEditorUpdate = useCallback((viewUpdate: ViewUpdate) => {
    logCollaborationStep("4.2", "handleEditorUpdate", {
      editorType,
      levelIndex,
      docChanged: viewUpdate.docChanged,
      selectionSet: viewUpdate.selectionSet,
    });
    if (!viewUpdate.view) {
      return;
    }

    const selection = viewUpdate.state.selection.main;
    updateEditorSelection?.(editorType, levelIndex, { from: selection.from, to: selection.to });

    if (!viewUpdate.docChanged) {
      return;
    }
    const nextValue = viewUpdate.state.doc.toString();
    if (codeRef.current === nextValue) {
      return;
    }
    const isLocalUserInput = viewUpdate.transactions.some(
      (transaction) =>
        transaction.docChanged &&
        (transaction.isUserEvent("input") ||
          transaction.isUserEvent("delete") ||
          transaction.isUserEvent("move") ||
          transaction.isUserEvent("select"))
    );
    codeRef.current = nextValue;
    codeUpdateOriginRef.current = "editor";
    setCode((prev) => (prev === nextValue ? prev : nextValue));
    reportEditorWatchState?.({
      editorType,
      levelIndex,
      content: nextValue,
      version: null,
      isEditable: !locked,
      isFocused: viewUpdate.view.hasFocus,
      isTyping: isLocalUserInput,
      source: isLocalUserInput ? "local_input" : "remote_apply",
    });

    if (!isLocalUserInput || applyingExternalUpdateRef.current || locked) {
      return;
    }

    onLocalChange?.();
    onLocalUserInput?.();

    if (!isConnected) {
      return;
    }

    handleTypingStart();
    if (typingPresenceTimeoutRef.current) {
      clearTimeout(typingPresenceTimeoutRef.current);
    }
    typingPresenceTimeoutRef.current = setTimeout(() => {
      handleTypingEnd();
    }, TYPING_IDLE_MS);
  }, [
    editorType,
    handleTypingEnd,
    handleTypingStart,
    isConnected,
    levelIndex,
    locked,
    onLocalChange,
    onLocalUserInput,
    reportEditorWatchState,
    setCode,
    typingPresenceTimeoutRef,
    updateEditorSelection,
  ]);

  /**
   * COLLABORATION STEP 3.7:
   * This callback records the live editor instance as soon as CodeMirror mounts.
   * That gives collaboration code a handle for focus checks, watchdog reporting,
   * caret drawing, and later remote update reconciliation.
   */
  const handleEditorCreate = useCallback((view: EditorView) => {
    logCollaborationStep("3.7", "handleEditorCreate", {
      editorType,
      levelIndex,
      isFocused: view.hasFocus,
    });
    editorViewRef.current = view;
    reportEditorWatchState?.({
      editorType,
      levelIndex,
      content: codeRef.current,
      version: null,
      isEditable: !locked,
      isFocused: view.hasFocus,
      isTyping: false,
      source: "focus",
    });
  }, [editorType, levelIndex, locked, reportEditorWatchState]);

  return {
    isConnected,
    remoteCarets,
    editorViewRef,
    editorViewportRef,
    applyingExternalUpdateRef,
    isYjsManaged: true,
    editorExtensions,
    editorKey: `yjs-${editorKey}:g${yjsDocGeneration}`,
    editorInitialState,
    handleCodeUpdate,
    handleEditorCreate,
    handleEditorUpdate,
  };
}
