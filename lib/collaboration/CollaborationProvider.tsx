"use client";

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import {
  ActiveUser,
  CanvasCursor,
  EditorCursor,
  EditorChange,
  UserIdentity,
  EditorType,
} from "./types";
import { useCollaborationConnection } from "./hooks/useCollaborationConnection";
import { useCollaborationCursor } from "./hooks/useCollaborationCursor";
import { useCollaborationPresence } from "./hooks/useCollaborationPresence";
import { useCollaborationEditor } from "./hooks/useCollaborationEditor";

interface CollaborationContextValue {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  groupId: string | null;
  clientId: string | null;
  activeUsers: ActiveUser[];
  remoteCursors: Map<string, CanvasCursor>;
  editorCursors: Map<string, EditorCursor>;
  updateCanvasCursor: (x: number, y: number) => void;
  updateEditorSelection: (editorType: EditorType, selection: { from: number; to: number }) => void;
  applyEditorChange: (editorType: EditorType, changes: unknown[]) => void;
  connect: () => void;
  disconnect: () => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

interface CollaborationProviderProps {
  children: React.ReactNode;
  groupId: string | null;
  user: UserIdentity | null;
}

export function CollaborationProvider({ children, groupId, user }: CollaborationProviderProps) {
  const [canvasCursors, setCanvasCursors] = useState<Map<string, CanvasCursor>>(new Map());
  const [editorCursors, setEditorCursors] = useState<Map<string, EditorCursor>>(new Map());

  const handleUserJoined = useCallback((joinedUser: ActiveUser) => {
    console.log("User joined:", joinedUser.userName || joinedUser.userEmail);
  }, []);

  const handleUserLeftId = useCallback((userId: string) => {
    console.log("User left:", userId);
    setCanvasCursors((prev) => {
      const next = new Map(prev);
      for (const [key, cursor] of next.entries()) {
        if (cursor.userId === userId) {
          next.delete(key);
        }
      }
      return next;
    });
    setEditorCursors((prev) => {
      const next = new Map(prev);
      for (const [key, cursor] of next.entries()) {
        if (cursor.userId === userId) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  const handleUserLeft = useCallback((leftUser: { userId: string; userEmail: string; userName?: string }) => {
    handleUserLeftId(leftUser.userId);
  }, [handleUserLeftId]);

  const handleCanvasCursor = useCallback((cursor: CanvasCursor) => {
    setCanvasCursors((prev) => {
      const next = new Map(prev);
      next.set(cursor.clientId, cursor);
      return next;
    });
  }, []);

  const handleEditorCursor = useCallback((cursor: EditorCursor) => {
    setEditorCursors((prev) => {
      const next = new Map(prev);
      next.set(`${cursor.clientId}-${cursor.editorType}`, cursor);
      return next;
    });
  }, []);

  const handleCurrentUsers = useCallback((users: ActiveUser[]) => {
    console.log("Current users:", users.length);
  }, []);

  const handleEditorChange = useCallback((change: EditorChange) => {
    console.log("Editor change received:", change.editorType, change.version);
  }, []);

  const {
    isConnected,
    isConnecting,
    error,
    clientId,
    connect,
    disconnect,
    sendCanvasCursor,
    sendEditorCursor,
    sendEditorChange,
  } = useCollaborationConnection({
    groupId,
    user,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onCanvasCursor: handleCanvasCursor,
    onEditorCursor: handleEditorCursor,
    onEditorChange: handleEditorChange,
    onCurrentUsers: handleCurrentUsers,
  });

  const { activeUsers, clearUsers } = useCollaborationPresence({
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeftId,
  });

  const { updateLocalCursor } = useCollaborationCursor({
    sendCursor: sendCanvasCursor,
    onRemoteCursor: handleCanvasCursor,
  });

  const { updateLocalSelection, applyLocalChange } = useCollaborationEditor({
    sendCursor: sendEditorCursor,
    sendChange: sendEditorChange,
    onRemoteCursor: handleEditorCursor,
    onRemoteChange: handleEditorChange,
  });

  useEffect(() => {
    if (isConnected) {
      clearUsers();
    }
  }, [isConnected, clearUsers]);

  useEffect(() => {
    return () => {
      clearUsers();
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
    };
  }, [clearUsers]);

  const updateCanvasCursor = useCallback(
    (x: number, y: number) => {
      updateLocalCursor(x, y);
    },
    [updateLocalCursor]
  );

  const updateEditorSelection = useCallback(
    (editorType: EditorType, selection: { from: number; to: number }) => {
      updateLocalSelection(editorType, selection);
    },
    [updateLocalSelection]
  );

  const applyEditorChangeWrapper = useCallback(
    (editorType: EditorType, changes: unknown[]) => {
      applyLocalChange(editorType, changes);
    },
    [applyLocalChange]
  );

  const value = useMemo<CollaborationContextValue>(
    () => ({
      isConnected,
      isConnecting,
      error,
      groupId,
      clientId,
      activeUsers,
      remoteCursors: canvasCursors,
      editorCursors,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChange: applyEditorChangeWrapper,
      connect,
      disconnect,
    }),
    [
      isConnected,
      isConnecting,
      error,
      groupId,
      clientId,
      activeUsers,
      canvasCursors,
      editorCursors,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChangeWrapper,
      connect,
      disconnect,
    ]
  );

  return (
    <CollaborationContext.Provider value={value}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration(): CollaborationContextValue {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error("useCollaboration must be used within a CollaborationProvider");
  }
  return context;
}
