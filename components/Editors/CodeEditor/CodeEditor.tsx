/** @format */
'use client';

import { html } from "@codemirror/lang-html";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, tooltips } from "@codemirror/view";
import { githubLight } from "@uiw/codemirror-theme-github";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import CodeMirror from "@uiw/react-codemirror";
import type { ReactCodeMirrorProps } from "@uiw/react-codemirror";
import { useCodeMirror } from "@uiw/react-codemirror";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { PencilOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logCollaborationStep } from "@/lib/collaboration/logCollaborationStep";
import { useAppSelector } from "@/store/hooks/hooks";
import { useGameplayTelemetry } from "@/components/General/useGameplayTelemetry";
import { useOptionalCollaboration } from "@/lib/collaboration/CollaborationProvider";

import {
  commentKeymapCompartment,
  reviewDecorationsCompartment,
} from "./constants";
import { useGameRuntimeConfig } from "@/hooks/useGameRuntimeConfig";
import { getCommentKeymap } from "./getCommentKeyMap";
import { RemoteCaretsOverlay } from "./RemoteCaretsOverlay";
import { createConsistentLineTheme } from "./theme";
import type { CodeEditorProps } from "./types";
import { useCodeEditorCollaboration } from "./useCodeEditorCollaboration";
import { titleToEditorType } from "./utils";

const lineNumberCompartment = new Compartment();

/**
 * COLLABORATION STEP 3.3:
 * Minimal host component that mounts a CodeMirror instance against the shared
 * Yjs-backed editor state prepared by the collaboration hook.
 */
function YjsEditorSurface({
  editorProps,
  editorKey,
  editorInitialState,
  style,
}: {
  editorProps: ReactCodeMirrorProps;
  editorKey: string;
  editorInitialState: { json: unknown };
  style: React.CSSProperties;
}) {
  logCollaborationStep("3.3", "YjsEditorSurface render", { editorKey });
  const hostRef = useRef<HTMLDivElement | null>(null);
  const { setContainer } = useCodeMirror({
    ...editorProps,
    initialState: editorInitialState,
  });

  useEffect(() => {
    if (hostRef.current) {
      setContainer(hostRef.current);
    }
  }, [setContainer]);

  return <div key={editorKey} ref={hostRef} style={style} />;
}

/**
 * COLLABORATION STEP 3.4:
 * Top-level code editor component. In collaboration mode it delegates shared
 * editing to the Yjs hook while still handling review UI, telemetry, and the
 * local-to-Redux bridge used elsewhere in the app.
 */
export default function CodeEditor({
  lang = html(),
  title = "HTML",
  template = "",
  codeUpdater,
  locked = false,
  type = "Template",
  levelIdentifier,
}: CodeEditorProps) {
  logCollaborationStep("3.4", "CodeEditor render", {
    title,
    type,
    levelIdentifier,
    locked,
  });
  const [code, setCode] = useState(template);
  const currentLevel = useAppSelector((state) => state.currentLevel.currentLevel);
  const options = useAppSelector((state) => state.options);
  const { recordPaste, recordEditorActivity } = useGameplayTelemetry();
  const { theme: nextTheme } = useTheme();
  const isDark =
    nextTheme === "dark" ||
    (nextTheme === "system" &&
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = isDark ? vscodeDark : githubLight;
  const consistentLineTheme = createConsistentLineTheme(isDark);
  const lastActivityTsRef = useRef<number | null>(null);
  const collaboration = useOptionalCollaboration();
  const { remoteSyncDebounceMs } = useGameRuntimeConfig();

  const {
    isConnected,
    remoteCarets,
    editorViewportRef,
    editorViewRef,
    applyingExternalUpdateRef,
    isYjsManaged,
    editorExtensions,
    editorKey,
    editorInitialState,
    handleCodeUpdate,
    handleEditorCreate,
    handleEditorUpdate,
  } = useCodeEditorCollaboration({
    title,
    code,
    setCode,
    template,
    enabled: type === "Template" || (type === "Solution" && options.creator),
    docKind: type === "Solution" ? "solution" : "template",
    locked,
    levelIdentifier,
    currentLevel,
    onLocalUserInput: options.mode === "game"
      ? () => {
          const now = Date.now();
          const delta = lastActivityTsRef.current == null ? 1200 : now - lastActivityTsRef.current;
          lastActivityTsRef.current = now;
          recordEditorActivity(currentLevel - 1, delta);
        }
      : undefined,
  });
  const editorType = titleToEditorType(title);
  const collaborationReady = !isYjsManaged || (collaboration?.isConnected === true && collaboration?.yjsReady === true);
  const readOnlySession = collaboration?.sessionRole === "readonly";
  const collaborationRecoveryNeeded = isYjsManaged && !locked && !collaborationReady;

  // Delay showing the recovery overlay so quick resyncs are invisible to users.
  const [showCollaborationRecoveryOverlay, setShowCollaborationRecoveryOverlay] = useState(false);
  useEffect(() => {
    if (!collaborationRecoveryNeeded) {
      setShowCollaborationRecoveryOverlay(false);
      return;
    }
    const timer = window.setTimeout(() => setShowCollaborationRecoveryOverlay(true), 600);
    return () => window.clearTimeout(timer);
  }, [collaborationRecoveryNeeded]);

  const isSolution = type === "Solution" || type === "solution";
  const flushPendingLocalCodeUpdate = useCallback((pendingCode) => {
    if (pendingCode === null || pendingCode === template) {
      return;
    }
    // In Yjs mode, Redux is synced from the shared Y.Doc observer in Editors.tsx.
    // Pushing transient local mirror state here creates a second authority and
    // can reintroduce stale template churn during concurrent typing.
    // Solution editors are never Yjs-managed and must always flush to Redux.
    if (isYjsManaged && !isSolution) {
      return;
    }
    // Skip if applying external update (avoids echo).
    if (applyingExternalUpdateRef.current) {
      return;
    }
    // #region agent log
    if (isSolution && isYjsManaged) {
      fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "02d82b" },
        body: JSON.stringify({
          sessionId: "02d82b",
          location: "CodeEditor.tsx:flushPendingLocalCodeUpdate",
          message: "redux_flush_solution_yjs",
          data: {
            lang: title.toLowerCase(),
            pendingLen: typeof pendingCode === "string" ? pendingCode.length : -1,
            hypothesisId: "H5",
          },
          timestamp: Date.now(),
          hypothesisId: "H5",
        }),
      }).catch(() => {});
    }
    // #endregion
    codeUpdater({ [title.toLowerCase()]: pendingCode }, type);
  }, [applyingExternalUpdateRef, codeUpdater, isSolution, isYjsManaged, template, title, type]);

  useEffect(() => {
    if (!isYjsManaged && applyingExternalUpdateRef.current) {
      return;
    }

    if (code === template) {
      return;
    }
    const timeout = setTimeout(() => {
      flushPendingLocalCodeUpdate(code);
    }, remoteSyncDebounceMs);

    return () => {
      clearTimeout(timeout);
    }
  }, [applyingExternalUpdateRef, code, flushPendingLocalCodeUpdate, isYjsManaged, remoteSyncDebounceMs, template]);

  useEffect(() => {
    if (!collaboration?.reportEditorWatchState) {
      return;
    }

    const interval = window.setInterval(() => {
      const view = editorViewRef.current;
      const isFocused = view?.hasFocus ?? false;
      const isEditable = !locked && Boolean(view?.contentDOM?.isContentEditable ?? true);
      const version = isYjsManaged ? null : collaboration.getEditorVersion(editorType, currentLevel - 1);

      collaboration.reportEditorWatchState({
        editorType,
        levelIndex: currentLevel - 1,
        content: code,
        version,
        isEditable,
        isFocused,
        isTyping: false,
        source: "interval",
      });

      if (isFocused && !isEditable && !locked) {
        collaboration.reportCollaborationHealthEvent("editor_readonly_stall", "warn", {
          contentLength: code.length,
          version,
        }, {
          editorType,
          levelIndex: currentLevel - 1,
        });
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [code, collaboration, currentLevel, editorType, isYjsManaged, locked, editorViewRef]);

  const sharedExtensions = [
    consistentLineTheme,
    tooltips({ parent: typeof document !== "undefined" ? document.body : undefined }),
  ];

  const canMountYjsSurface = isYjsManaged && collaboration?.isConnected === true && collaboration?.yjsReady === true;

  const editableEditorProps: ReactCodeMirrorProps = {
    extensions: [
      lang,
      EditorState.readOnly.of(locked || !collaborationReady || readOnlySession),
      EditorView.editable.of(!locked && collaborationReady && !readOnlySession),
      EditorView.lineWrapping,
      EditorView.domEventHandlers({
        paste: (event) => {
          if (options.mode !== "game") {
            return false;
          }
          const clipboardText = event.clipboardData?.getData("text") ?? "";
          recordPaste(currentLevel - 1, clipboardText.length);
          return false;
        },
      }),
      ...sharedExtensions,
      commentKeymapCompartment.of(keymap.of(getCommentKeymap(title))),
      reviewDecorationsCompartment.of([]),
      ...editorExtensions,
    ],
    theme,
    placeholder: `Write your ${title} here...`,
    ...(isYjsManaged
      ? {}
      : {
          onChange: (value: string) => {
            if (options.mode === "game") {
              const now = Date.now();
              const delta = lastActivityTsRef.current == null ? 1200 : now - lastActivityTsRef.current;
              lastActivityTsRef.current = now;
              recordEditorActivity(currentLevel - 1, delta);
            }
            handleCodeUpdate();
          },
        }),
    onCreateEditor: handleEditorCreate,
    onUpdate: handleEditorUpdate,
  };

  const fallbackReadOnlyProps: ReactCodeMirrorProps = {
    extensions: [
      lang,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      ...sharedExtensions,
      commentKeymapCompartment.of(keymap.of(getCommentKeymap(title))),
      reviewDecorationsCompartment.of([]),
    ],
    theme,
    placeholder: `Write your ${title} here...`,
  };

  const editorStyle: React.CSSProperties = {
    // Let the parent container own scrolling so HTML frame lines stay in flow.
    overflow: "visible",
    boxSizing: "border-box",
    margin: "0",
    padding: "0",
  };

  return (
    <div className="codeEditorContainer relative flex h-full min-h-0 w-full flex-1 flex-col">
      <div
        className="codeEditor relative flex min-h-0 flex-[1_1_20px] flex-col overflow-hidden"
        title={locked ? "You can't edit this code" : " Click on the code to edit it"}
      >
        {readOnlySession && (
          <div className="pointer-events-none absolute bottom-1 right-1 z-[100] flex items-center gap-1">
            <div className="pointer-events-auto flex items-center gap-1">
              {readOnlySession && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-amber-500"
                  onClick={() => window.dispatchEvent(new CustomEvent("collab:open-readonly-status"))}
                  title="Read-only session (click for details)"
                >
                  <PencilOff className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {locked && (
          <h3
            id="title"
            className="pointer-events-none absolute left-1/2 top-[20%] z-[1] -translate-x-1/2 -translate-y-1/2 -rotate-45 select-none overflow-hidden text-5xl text-red-500 opacity-20 drop-shadow-[2px_2px_2px_#000]"
          >
            Locked
          </h3>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <div ref={editorViewportRef} className="relative min-h-0">
            {isYjsManaged ? (
              canMountYjsSurface ? (
                <YjsEditorSurface
                  key={editorKey}
                  editorProps={editableEditorProps}
                  editorKey={editorKey}
                  editorInitialState={editorInitialState}
                  style={editorStyle}
                />
              ) : (
                <CodeMirror
                  {...fallbackReadOnlyProps}
                  key={`${editorKey}:fallback`}
                  value={code}
                  style={editorStyle}
                />
              )
            ) : (
              <CodeMirror
                {...editableEditorProps}
                key={editorKey}
                value={code}
                style={editorStyle}
              />
            )}
            {isConnected && <RemoteCaretsOverlay carets={remoteCarets} />}
            {showCollaborationRecoveryOverlay && (
              <div className="pointer-events-none absolute inset-0 z-20 flex animate-in fade-in duration-300 items-center justify-center bg-background/45 backdrop-blur-sm">
                <div className="flex items-center gap-3 rounded-full border border-border/70 bg-background/90 px-4 py-2 text-sm text-foreground shadow-lg shadow-black/10">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">Resyncing shared editor</span>
                    <span className="text-xs text-muted-foreground">Changes will be ready in a moment</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
