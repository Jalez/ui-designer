"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ActiveUser, CanvasCursor, EditorCursor, EditorChange, UserIdentity } from "../types";
import { generateClientId, generateUserColor, getWebSocketUrl } from "../utils";
import { RECONNECT_DELAY_MS, MAX_RECONNECT_ATTEMPTS } from "../constants";

interface UseCollaborationConnectionOptions {
  groupId: string | null;
  user: UserIdentity | null;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onUserJoined?: (user: ActiveUser) => void;
  onUserLeft?: (user: { userId: string; userEmail: string; userName?: string }) => void;
  onCanvasCursor?: (cursor: CanvasCursor) => void;
  onEditorCursor?: (cursor: EditorCursor) => void;
  onEditorChange?: (change: EditorChange) => void;
  onCurrentUsers?: (users: ActiveUser[]) => void;
}

interface UseCollaborationConnectionReturn {
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  clientId: string | null;
  connect: () => void;
  disconnect: () => void;
  joinGame: (groupId: string) => void;
  leaveGame: () => void;
  sendCanvasCursor: (x: number, y: number) => void;
  sendEditorCursor: (editorType: "html" | "css" | "js", selection: { from: number; to: number }) => void;
  sendEditorChange: (editorType: "html" | "css" | "js", version: number, changes: unknown[]) => void;
}

export function useCollaborationConnection(
  options: UseCollaborationConnectionOptions
): UseCollaborationConnectionReturn {
  const {
    groupId,
    user,
    onConnected,
    onDisconnected,
    onError,
    onUserJoined,
    onUserLeft,
    onCanvasCursor,
    onEditorCursor,
    onEditorChange,
    onCurrentUsers,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const userColorRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<Socket | null>(null);

  useEffect(() => {
    if (!groupId || !user) {
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    const newClientId = generateClientId();
    clientIdRef.current = newClientId;
    if (!userColorRef.current) {
      userColorRef.current = generateUserColor(user.email);
    }

    const wsUrl = getWebSocketUrl();

    const socket = io(wsUrl, {
      auth: {
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userImage: user.image,
        groupId,
      },
      transports: ["websocket", "polling"],
      reconnection: false,
    });

    socketRef.current = socket;
    isConnectedRef.current = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const disconnectSocket = () => {
      clearReconnectTimeout();
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      isConnectedRef.current = false;
    };

    socket.on("connect", () => {
      isConnectedRef.current = true;
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      setClientId(newClientId);
      setSocketState(socket);
      reconnectAttemptsRef.current = 0;

      socket.emit("join-game", {
        groupId,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        userImage: user.image,
      });

      onConnected?.();
    });

    socket.on("disconnect", (reason) => {
      isConnectedRef.current = false;
      setIsConnected(false);
      setIsConnecting(false);
      onDisconnected?.();

      if (reason === "io server disconnect") {
        return;
      }

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (socketRef.current && !isConnectedRef.current) {
            socketRef.current.connect();
          }
        }, RECONNECT_DELAY_MS);
      } else {
        setError("Failed to reconnect after multiple attempts");
        onError?.("Failed to reconnect after multiple attempts");
      }
    });

    socket.on("connect_error", (err) => {
      setIsConnected(false);
      setIsConnecting(false);
      setError(err.message);
      onError?.(err.message);
    });

    socket.on("error", (data: { error?: string }) => {
      setError(data.error || "Unknown error");
      onError?.(data.error || "Unknown error");
    });

    socket.on("user-joined", (data: { clientId?: string; userId: string; userEmail: string; userName?: string; userImage?: string }) => {
      if (data.userEmail !== user.email) {
        onUserJoined?.({
          clientId: data.clientId || socket.id || "",
          userId: data.userId,
          userEmail: data.userEmail,
          userName: data.userName,
          userImage: data.userImage,
        });
      }
    });

    socket.on("user-left", (data: { userId: string; userEmail: string; userName?: string }) => {
      onUserLeft?.({
        userId: data.userId,
        userEmail: data.userEmail,
        userName: data.userName,
      });
    });

    socket.on("current-users", (data: { users?: Array<{ clientId: string; userId?: string; userEmail: string; userName?: string; userImage?: string; color?: string }> }) => {
      if (data.users && Array.isArray(data.users)) {
        onCurrentUsers?.(
          data.users.map((u) => ({
            clientId: u.clientId,
            userId: u.userId || "",
            userEmail: u.userEmail,
            userName: u.userName,
            userImage: u.userImage,
            color: u.color || generateUserColor(u.userEmail),
          }))
        );
      }
    });

    socket.on("canvas-cursor", (data: CanvasCursor & { clientId: string }) => {
      if (data.clientId !== clientIdRef.current) {
        onCanvasCursor?.(data);
      }
    });

    socket.on("editor-cursor", (data: EditorCursor & { clientId: string }) => {
      if (data.clientId !== clientIdRef.current) {
        onEditorCursor?.(data);
      }
    });

    socket.on("editor-change", (data: EditorChange) => {
      onEditorChange?.(data);
    });

    return () => {
      clearReconnectTimeout();
      disconnectSocket();
    };
  }, [groupId, user, onConnected, onDisconnected, onError, onUserJoined, onUserLeft, onCanvasCursor, onEditorCursor, onEditorChange, onCurrentUsers]);

  const sendCanvasCursor = (x: number, y: number) => {
    if (socketRef.current && groupId && user && clientIdRef.current) {
      socketRef.current.emit("canvas-cursor", {
        groupId,
        clientId: clientIdRef.current,
        userId: user.id,
        userName: user.name,
        color: userColorRef.current,
        x,
        y,
        ts: Date.now(),
      });
    }
  };

  const sendEditorCursor = (editorType: "html" | "css" | "js", selection: { from: number; to: number }) => {
    if (socketRef.current && groupId && user && clientIdRef.current) {
      socketRef.current.emit("editor-cursor", {
        groupId,
        editorType,
        clientId: clientIdRef.current,
        userId: user.id,
        userName: user.name,
        color: userColorRef.current,
        selection,
        ts: Date.now(),
      });
    }
  };

  const sendEditorChange = (editorType: "html" | "css" | "js", version: number, changes: unknown[]) => {
    if (socketRef.current && groupId && user && clientIdRef.current) {
      socketRef.current.emit("editor-change", {
        groupId,
        editorType,
        clientId: clientIdRef.current,
        userId: user.id,
        version,
        changes,
      });
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    isConnectedRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
    setClientId(null);
    setSocketState(null);
    clientIdRef.current = null;
  };

  const leaveGame = () => {
    if (socketRef.current && groupId) {
      socketRef.current.emit("leave-game", { groupId });
    }
    disconnect();
  };

  return {
    socket: socketState,
    isConnected,
    isConnecting,
    error,
    clientId,
    connect: () => {},
    disconnect,
    joinGame: () => {},
    leaveGame,
    sendCanvasCursor,
    sendEditorCursor,
    sendEditorChange,
  };
}
