"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActiveUser,
  CanvasCursor,
  ClientHealthEventMessage,
  ClientStateHashMessage,
  CollaborationHealthMessage,
  GroupStartSyncMessage,
  IdentityAssignedMessage,
  LobbyChatEntry,
  LobbyChatSyncMessage,
  ProgressSyncMessage,
  RoomStateSyncMessage,
  UserIdentity,
  EditorType,
  YjsProtocolMessage,
  GameInstancesResetMessage,
  LevelMetaUpdateMessage,
  LevelMetaOperation,
} from "../types";
import { logCollaborationStep } from "../logCollaborationStep";
import { extractGroupIdFromRoomId, generateClientId, generateUserColor, getWebSocketUrl } from "../utils";
import { RECONNECT_DELAY_MS, MAX_RECONNECT_ATTEMPTS } from "../constants";
import { logDebugClient } from "@/lib/debug-logger";
import { apiUrl } from "@/lib/apiUrl";

const INITIAL_CONNECT_DELAY_MS = 25;

interface UseCollaborationConnectionOptions {
  roomId: string | null;
  user: UserIdentity | null;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: string) => void;
  onUserJoined?: (user: ActiveUser) => void;
  onUserLeft?: (user: { clientId?: string; userId: string; userEmail: string; userName?: string }) => void;
  onCanvasCursor?: (cursor: CanvasCursor) => void;
  onCurrentUsers?: (users: ActiveUser[]) => void;
  onRoomStateSync?: (roomState: RoomStateSyncMessage) => void;
  onProgressSync?: (message: ProgressSyncMessage) => void;
  onGroupStartSync?: (message: GroupStartSyncMessage) => void;
  onLobbyChatSync?: (message: LobbyChatSyncMessage) => void;
  onLobbyChatMessage?: (message: LobbyChatEntry) => void;
  onYjsProtocol?: (message: YjsProtocolMessage) => void;
  onGameInstancesReset?: (message: GameInstancesResetMessage) => void;
  onIdentityAssigned?: (message: IdentityAssignedMessage) => void;
  onCollaborationHealth?: (message: CollaborationHealthMessage) => void;
  onLevelMetaUpdate?: (message: LevelMetaUpdateMessage) => void;
  onTransportMessage?: (type: string) => void;
}

interface UseCollaborationConnectionReturn {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  isSessionEvicted: boolean;
  sessionRole: "active" | "readonly";
  reclaimSession: () => void;
  connectReadOnly: () => void;
  consumeSkipNextReconnectRecovery: () => boolean;
  clientId: string | null;
  connect: () => void;
  disconnect: () => void;
  joinGame: (roomId: string) => void;
  leaveGame: () => void;
  sendCanvasCursor: (x: number, y: number) => void;
  requestRoomStateSync: (reason?: string) => void;
  sendYjsProtocol: (message: Omit<YjsProtocolMessage, "roomId" | "groupId" | "ts">) => void;
  sendRoomReset: (scope: "level" | "game", levelIndex?: number) => void;
  sendProgressSync: (progressData: Record<string, unknown>) => void;
  sendGroupStartReady: () => void;
  sendGroupStartUnready: () => void;
  sendLobbyChat: (text: string) => void;
  sendClientStateHash: (message: Omit<ClientStateHashMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => void;
  sendClientHealthEvent: (message: Omit<ClientHealthEventMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => void;
  sendLevelMetaUpdate: (operation: LevelMetaOperation, opts?: { levelIndex?: number; fields?: Record<string, unknown>; level?: Record<string, unknown> }) => void;
  effectiveIdentity: UserIdentity | null;
}

interface WebSocketEnvelope<T = unknown> {
  type: string;
  payload: T;
  ts?: number;
}

/**
 * COLLABORATION STEP 1.1:
 * Every websocket message arrives as raw text. This helper unwraps that text into
 * a typed envelope so the rest of the collaboration flow can reason about the
 * message safely instead of working with untrusted raw strings.
 */
function parseEnvelope(data: string): WebSocketEnvelope | null {
  logCollaborationStep("1.1", "parseEnvelope", {
    payloadLength: data.length,
  });
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return null;
    }
    return parsed as WebSocketEnvelope;
  } catch {
    return null;
  }
}

/**
 * COLLABORATION STEP 1.2:
 * This hook owns the browser's websocket session for collaboration. In plain
 * terms, it connects the player to the group room, translates app actions into
 * socket messages, and fans incoming server messages back out to the provider.
 */
export function useCollaborationConnection(
  options: UseCollaborationConnectionOptions
): UseCollaborationConnectionReturn {
  logCollaborationStep("1.2", "useCollaborationConnection", {
    roomId: options.roomId,
    hasUser: Boolean(options.user),
  });
  const { roomId, user } = options;
  const parsedGroupId = extractGroupIdFromRoomId(roomId);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const socketRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const userColorRef = useRef<string | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialConnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isConnectedRef = useRef(false);
  const reconnectFnRef = useRef<(() => void) | null>(null);
  const connectInFlightRef = useRef(false);
  const manualDisconnectRef = useRef(false);
  const effectiveIdentityRef = useRef<UserIdentity | null>(user);
  const terminalErrorRef = useRef<string | null>(null);
  const lastConnectedAtRef = useRef<number>(0);
  const sessionRoleRef = useRef<"active" | "readonly">("active");
  const skipNextReconnectRecoveryRef = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSessionEvicted, setIsSessionEvicted] = useState(false);
  const [sessionRole, setSessionRole] = useState<"active" | "readonly">("active");
  const [clientId, setClientId] = useState<string | null>(null);
  const [socketState, setSocketState] = useState<WebSocket | null>(null);
  const [effectiveIdentity, setEffectiveIdentity] = useState<UserIdentity | null>(user);

  const userIdentity = user ? `${user.id}|${user.email}` : null;

  useEffect(() => {
    setEffectiveIdentity(user);
    effectiveIdentityRef.current = user;
    terminalErrorRef.current = null;
  }, [userIdentity, user]);

  /**
   * COLLABORATION STEP 6.1:
   * This is the one generic "put a collaboration packet on the wire" helper.
   * Everything from room join to Yjs sync and health reports eventually funnels
   * through this serializer before it leaves the browser.
   */
  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    logCollaborationStep("6.1", "sendMessage", {
      type,
      roomId,
    });
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type,
        payload,
        ts: Date.now(),
      } satisfies WebSocketEnvelope<Record<string, unknown>>)
    );
  }, []);

  useEffect(() => {
    if (!roomId || !userIdentity) {
      return;
    }

    const opts = optionsRef.current;
    const currentUser = opts.user;
    if (!currentUser) {
      return;
    }

    console.log(`[ws-lifecycle] effect-run room=${roomId} userIdentity=${userIdentity}`);
    logDebugClient("ws_connection_start", {
      roomId,
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
    });

    const newClientId = generateClientId();
    clientIdRef.current = newClientId;
    if (!userColorRef.current) {
      userColorRef.current = generateUserColor(currentUser.email);
    }

    let disposed = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const clearInitialConnectTimeout = () => {
      if (initialConnectTimeoutRef.current) {
        clearTimeout(initialConnectTimeoutRef.current);
        initialConnectTimeoutRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log(`[ws-lifecycle] giving up after ${MAX_RECONNECT_ATTEMPTS} attempts room=${roomId}`);
        setError("Failed to reconnect after multiple attempts");
        optionsRef.current.onError?.("Failed to reconnect after multiple attempts");
        return;
      }
      reconnectAttemptsRef.current += 1;
      console.log(`[ws-lifecycle] scheduling reconnect #${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${RECONNECT_DELAY_MS}ms room=${roomId}`);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!disposed && !manualDisconnectRef.current) {
          connectSocket();
        }
      }, RECONNECT_DELAY_MS);
    };

    const fetchWsAuthToken = async () => {
      const response = await fetch(apiUrl("/api/collaboration/ws-token"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload?.token !== "string" || payload.token.length === 0) {
        const message =
          typeof payload?.error === "string" && payload.error
            ? payload.error
            : "Failed to authorize collaboration session";
        const error = new Error(message);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }

      return payload.token as string;
    };

    const cleanupSocket = () => {
      clearReconnectTimeout();
      clearInitialConnectTimeout();
      const socket = socketRef.current;
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
        socketRef.current = null;
      }
      setSocketState(null);
      isConnectedRef.current = false;
    };

    /**
     * COLLABORATION STEP 1.3:
     * Open the websocket, join the room, and wire all message handlers. This is
     * where the browser actually steps into the shared collaboration session.
     */
    const connectSocket = () => {
      logCollaborationStep("1.3", "connectSocket", {
        roomId,
        userId: currentUser.id,
      });
      console.log(`[ws-lifecycle] connectSocket room=${roomId} attempt=${reconnectAttemptsRef.current} disposed=${disposed} hasSocket=${!!socketRef.current}`);
      if (disposed || socketRef.current || connectInFlightRef.current) {
        return;
      }
      connectInFlightRef.current = true;
      setIsConnecting(true);

      void (async () => {
        let authToken = "";
        try {
          authToken = await fetchWsAuthToken();
        } catch (error) {
          connectInFlightRef.current = false;
          setIsConnecting(false);
          const status = (error as Error & { status?: number })?.status;
          const message = error instanceof Error ? error.message : "Failed to authorize collaboration session";
          terminalErrorRef.current = message;
          setError(message);
          optionsRef.current.onError?.(message);
          if (status === 401 || status === 403) {
            manualDisconnectRef.current = true;
            return;
          }
          if (!disposed && !manualDisconnectRef.current) {
            scheduleReconnect();
          }
          return;
        }

        if (disposed || socketRef.current) {
          connectInFlightRef.current = false;
          return;
        }

        const wsUrl = getWebSocketUrl();
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        setSocketState(socket);

        socket.onopen = () => {
          connectInFlightRef.current = false;
          if (disposed) {
            socket.close();
            return;
        }

        console.log(`[ws-lifecycle] onopen room=${roomId} clientId=${newClientId} reconnectAttempts=${reconnectAttemptsRef.current}`);
        isConnectedRef.current = true;
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        terminalErrorRef.current = null;
        setClientId(newClientId);
        lastConnectedAtRef.current = Date.now();

        logDebugClient("ws_socket_connect", {
          clientId: newClientId,
          roomId,
          userId: currentUser.id,
          userEmail: currentUser.email,
          wsUrl,
        });

          socket.send(
          JSON.stringify({
            type: "join-game",
            payload: {
              roomId,
              groupId: parsedGroupId ?? undefined,
              clientId: newClientId,
              authToken,
              sessionRole: sessionRoleRef.current,
            },
            ts: Date.now(),
          } satisfies WebSocketEnvelope<Record<string, unknown>>)
          );

        logDebugClient("ws_join_game_emitted", {
          roomId,
          userId: currentUser.id,
          userEmail: currentUser.email,
        });

        optionsRef.current.onConnected?.();
        };

      /**
       * COLLABORATION STEP 12.1:
       * Incoming collaboration traffic lands here first. This switch turns generic
       * server packets into specific callbacks so the provider can update room
       * state, Yjs state, presence, health signals, and recovery logic.
       */
        socket.onmessage = (event) => {
        logCollaborationStep("12.1", "socket.onmessage", {
          roomId,
          dataType: typeof event.data,
        });
        if (typeof event.data !== "string") {
          return;
        }

        const envelope = parseEnvelope(event.data);
        if (!envelope) {
          return;
        }

        const payload = envelope.payload;
        optionsRef.current.onTransportMessage?.(envelope.type);

        switch (envelope.type) {
          case "error": {
            const errorPayload = payload as { error?: unknown; code?: unknown } | null;
            const nextError =
              errorPayload && typeof errorPayload === "object" && typeof errorPayload.error === "string"
                ? errorPayload.error
                : "Unknown error";
            if (errorPayload && typeof errorPayload.code === "string" && (errorPayload.code === "duplicate_users_blocked" || errorPayload.code === "auth_failed")) {
              terminalErrorRef.current = nextError;
              manualDisconnectRef.current = true;
            }
            setError(nextError);
            optionsRef.current.onError?.(nextError);
            return;
          }
          case "user-joined": {
            const data = payload as {
              clientId?: string;
              userId: string;
              accountUserId?: string;
              userEmail: string;
              accountUserEmail?: string;
              userName?: string;
              userImage?: string;
              activeTab?: EditorType;
              activeLevelIndex?: number;
              isTyping?: boolean;
            };
            const current = effectiveIdentityRef.current ?? optionsRef.current.user;
            if (!current) {
              return;
            }
            if (data.userId === current.id) {
              return;
            }
            const joinedClientId = data.clientId ?? "";
            if (joinedClientId) {
              queueMicrotask(() => optionsRef.current.onUserJoined?.({
                clientId: joinedClientId,
                userId: data.userId,
                accountUserId: data.accountUserId,
                userEmail: data.userEmail,
                accountUserEmail: data.accountUserEmail,
                userName: data.userName,
                userImage: data.userImage,
                activeTab: data.activeTab,
                activeLevelIndex: data.activeLevelIndex,
                isTyping: data.isTyping,
              }));
            }
            return;
          }
          case "user-left": {
            const data = payload as { clientId?: string; userId: string; userEmail: string; userName?: string };
            optionsRef.current.onUserLeft?.(data);
            return;
          }
          case "current-users": {
            const data = payload as {
              users?: Array<{
                clientId?: string;
                userId?: string;
                accountUserId?: string;
                userEmail: string;
                accountUserEmail?: string;
                userName?: string;
                userImage?: string;
                color?: string;
                activeTab?: EditorType;
                activeLevelIndex?: number;
                isTyping?: boolean;
              }>;
            };
            if (data.users && Array.isArray(data.users)) {
              const current = optionsRef.current.user;
              const selfIdentity = effectiveIdentityRef.current ?? current;
              const mapped = data.users
                .filter((entry) => entry && (entry.clientId ?? "").length > 0)
                .filter((entry) => {
                  if (!selfIdentity) {
                    return true;
                  }

                  if (entry.userId && entry.userId === selfIdentity.id) {
                    return false;
                  }

                  if (!entry.userId && entry.userEmail && entry.userEmail === selfIdentity.email) {
                    return false;
                  }

                  return true;
                })
                .map((entry) => ({
                  clientId: entry.clientId ?? "",
                  userId: entry.userId || "",
                  accountUserId: entry.accountUserId,
                  userEmail: entry.userEmail,
                  accountUserEmail: entry.accountUserEmail,
                  userName: entry.userName,
                  userImage: entry.userImage,
                  color: entry.color || generateUserColor(entry.userEmail),
                  activeTab: entry.activeTab,
                  activeLevelIndex: Number.isInteger(entry.activeLevelIndex) ? entry.activeLevelIndex : undefined,
                  isTyping: Boolean(entry.isTyping),
                }));
              if (mapped.length > 0) {
                queueMicrotask(() => optionsRef.current.onCurrentUsers?.(mapped));
              }
            }
            return;
          }
          case "canvas-cursor": {
            const data = payload as CanvasCursor & { clientId: string };
            if (data.clientId !== clientIdRef.current) {
              optionsRef.current.onCanvasCursor?.(data);
            }
            return;
          }
          case "room-state-sync":
            optionsRef.current.onRoomStateSync?.(payload as RoomStateSyncMessage);
            return;
          case "progress-sync":
            optionsRef.current.onProgressSync?.(payload as ProgressSyncMessage);
            return;
          case "group-start-sync":
            optionsRef.current.onGroupStartSync?.(payload as GroupStartSyncMessage);
            return;
          case "identity-assigned": {
            const data = payload as IdentityAssignedMessage;
            const previousIdentity = effectiveIdentityRef.current ?? optionsRef.current.user;
            const nextIdentity: UserIdentity = {
              id: data.userId,
              email: data.userEmail,
              name: data.userName ?? previousIdentity?.name,
              image: data.userImage ?? previousIdentity?.image,
            };
            setEffectiveIdentity(nextIdentity);
            effectiveIdentityRef.current = nextIdentity;
            optionsRef.current.onIdentityAssigned?.(data);
            return;
          }
          case "lobby-chat-sync":
            optionsRef.current.onLobbyChatSync?.(payload as LobbyChatSyncMessage);
            return;
          case "lobby-chat-message":
            optionsRef.current.onLobbyChatMessage?.(payload as LobbyChatEntry);
            return;
          case "yjs-protocol":
            optionsRef.current.onYjsProtocol?.(payload as YjsProtocolMessage);
            return;
          case "game-instances-reset":
            optionsRef.current.onGameInstancesReset?.(payload as GameInstancesResetMessage);
            return;
          case "collaboration-health":
            optionsRef.current.onCollaborationHealth?.(payload as CollaborationHealthMessage);
            return;
          case "level-meta-update":
            optionsRef.current.onLevelMetaUpdate?.(payload as LevelMetaUpdateMessage);
            return;
          case "session-demoted":
            // Another tab from the same account reclaimed active status. Stay
            // connected as read-only so the Yjs doc keeps receiving updates —
            // no reconnect, no resync needed.
            console.log(`[ws-lifecycle] session-demoted room=${roomId}`);
            sessionRoleRef.current = "readonly";
            setSessionRole("readonly");
            setIsSessionEvicted(true);
            return;
          case "session-role-changed": {
            const roleData = payload as { role: "active" | "readonly" };
            const nextRole = roleData.role === "readonly" ? "readonly" : "active";
            console.log(`[ws-lifecycle] session-role-changed role=${nextRole} room=${roomId}`);
            sessionRoleRef.current = nextRole;
            setSessionRole(nextRole);
            if (nextRole === "active") {
              setIsSessionEvicted(false);
            }
            return;
          }
          default:
            return;
        }
      };

        socket.onerror = () => {
          connectInFlightRef.current = false;
          setIsConnected(false);
          setIsConnecting(false);
        if (terminalErrorRef.current) {
          setError(terminalErrorRef.current);
          optionsRef.current.onError?.(terminalErrorRef.current);
        }
      };

        socket.onclose = (event) => {
          connectInFlightRef.current = false;
          const wasConnected = isConnectedRef.current;
        const connectionDurationSec = lastConnectedAtRef.current > 0
          ? ((Date.now() - lastConnectedAtRef.current) / 1000).toFixed(1)
          : "N/A";
        console.log(`[ws-lifecycle] onclose room=${roomId} code=${event.code} reason=${JSON.stringify(event.reason)} wasConnected=${wasConnected} connDuration=${connectionDurationSec}s attempt=${reconnectAttemptsRef.current} disposed=${disposed} manualDisconnect=${manualDisconnectRef.current}`);
        logDebugClient("ws_socket_close", {
          roomId,
          clientId: clientIdRef.current,
          userId: currentUser.id,
          userEmail: currentUser.email,
          code: event.code,
          reason: event.reason,
          readyState: socket.readyState,
        });
        if (socketRef.current === socket) {
          socketRef.current = null;
          setSocketState(null);
        }
        isConnectedRef.current = false;
        setIsConnected(false);
        setIsConnecting(false);

          if (event.code === 4008) {
          const nextError = terminalErrorRef.current
            || event.reason
            || "Duplicate users are blocked for this game. Turn group submission off in A+ or ask the creator to enable duplicate users in Game Settings.";
          terminalErrorRef.current = nextError;
          manualDisconnectRef.current = true;
          setError(nextError);
          optionsRef.current.onError?.(nextError);
          return;
        }

        // 4009 = "Replaced by new session" — another tab from the same account
        // joined this room and the server evicted us. Show a modal so the user
        // can choose to reclaim the session in this tab.
          if (event.code === 4009) {
          console.log(`[ws-lifecycle] 4009 evicted by duplicate session room=${roomId}`);
          manualDisconnectRef.current = true;
          setIsSessionEvicted(true);
          return;
        }

          if (event.code === 4401 || event.code === 4403) {
            const nextError = terminalErrorRef.current || event.reason || "Collaboration authorization failed";
            terminalErrorRef.current = nextError;
            manualDisconnectRef.current = true;
            setError(nextError);
            optionsRef.current.onError?.(nextError);
            return;
          }

          if (disposed || manualDisconnectRef.current) {
          if (terminalErrorRef.current) {
            setError(terminalErrorRef.current);
            optionsRef.current.onError?.(terminalErrorRef.current);
          }
          return;
        }

        if (wasConnected) {
          optionsRef.current.onDisconnected?.();
        }

        if (terminalErrorRef.current) {
          setError(terminalErrorRef.current);
          optionsRef.current.onError?.(terminalErrorRef.current);
          return;
        }

        // Only reset the reconnect counter if the connection was stable
        // (lasted more than 30s). This prevents infinite rapid reconnect
        // cycles where each connection opens briefly then dies.
        const connectionDurationMs = lastConnectedAtRef.current > 0
          ? Date.now() - lastConnectedAtRef.current
          : 0;
        if (connectionDurationMs > 30_000) {
          reconnectAttemptsRef.current = 0;
        }

          scheduleReconnect();
        };
      })();
    };

    reconnectFnRef.current = connectSocket;
    manualDisconnectRef.current = false;
    initialConnectTimeoutRef.current = setTimeout(() => {
      initialConnectTimeoutRef.current = null;
      connectSocket();
    }, INITIAL_CONNECT_DELAY_MS);

    return () => {
      console.log(`[ws-lifecycle] effect-cleanup room=${roomId} userIdentity=${userIdentity}`);
      disposed = true;
      reconnectFnRef.current = null;
      connectInFlightRef.current = false;
      cleanupSocket();
    };
  }, [roomId, parsedGroupId, userIdentity]);

  /**
   * COLLABORATION STEP 19.1:
   * Tear down the local websocket session and clear reconnect machinery so this
   * browser stops participating in the room cleanly.
   */
  const disconnect = useCallback(() => {
    logCollaborationStep("19.1", "disconnect", {
      roomId,
    });
    manualDisconnectRef.current = true;
    if (initialConnectTimeoutRef.current) {
      clearTimeout(initialConnectTimeoutRef.current);
      initialConnectTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    const socket = socketRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      socketRef.current = null;
    }
    connectInFlightRef.current = false;
    isConnectedRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
    setClientId(null);
    setSocketState(null);
    clientIdRef.current = null;
  }, []);

  /**
   * COLLABORATION STEP 19.2:
   * Tell the server this client is leaving the room and then close the local
   * socket so presence, awareness, and duplicate-session tracking are cleaned up.
   */
  const leaveGame = useCallback(() => {
    logCollaborationStep("19.2", "leaveGame", {
      roomId,
    });
    if (roomId) {
      sendMessage("leave-game", {
        roomId,
        groupId: parsedGroupId ?? undefined,
      });
    }
    disconnect();
  }, [disconnect, parsedGroupId, roomId, sendMessage]);

  const sendCanvasCursor = useCallback((x: number, y: number) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("canvas-cursor", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userName: effectiveIdentity.name,
        color: userColorRef.current,
        x,
        y,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  /**
   * COLLABORATION STEP 18.1:
   * Ask the server for a fresh authoritative room snapshot when the client thinks
   * it may have missed something or needs to recover from a suspicious state.
   */
  const requestRoomStateSync = useCallback((reason = "client_request") => {
    logCollaborationStep("18.1", "requestRoomStateSync", {
      roomId,
      reason,
    });
    if (!roomId) {
      return;
    }
    sendMessage("request-room-state-sync", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      reason,
    });
    logDebugClient("ws_room_state_sync_requested", {
      roomId,
      groupId: parsedGroupId,
      reason,
    });
  }, [parsedGroupId, roomId, sendMessage]);

  /**
   * COLLABORATION STEP 6.2:
   * Ship a Yjs sync or awareness payload to the websocket backend. This is the
   * transport bridge between local CRDT state and the shared room on the server.
   */
  const sendYjsProtocol = useCallback((message: Omit<YjsProtocolMessage, "roomId" | "groupId" | "ts">) => {
    logCollaborationStep("6.2", "sendYjsProtocol", {
      roomId,
      channel: message.channel,
    });
    if (!roomId || !message.payloadBase64) {
      return;
    }

    logDebugClient("ws_yjs_protocol_emit", {
      roomId,
      groupId: parsedGroupId,
      channel: message.channel,
      payloadLength: message.payloadBase64.length,
    });
    sendMessage("yjs-protocol", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      ...message,
      ts: Date.now(),
    } satisfies YjsProtocolMessage);
  }, [parsedGroupId, roomId, sendMessage]);

  const sendRoomReset = useCallback((scope: "level" | "game", levelIndex?: number) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      logDebugClient("ws_reset_room_emit", {
        roomId,
        groupId: parsedGroupId ?? null,
        userId: effectiveIdentity.id,
        userEmail: effectiveIdentity.email,
        clientId: clientIdRef.current,
        scope,
        levelIndex: Number.isInteger(levelIndex) ? levelIndex : null,
      });
      sendMessage("reset-room-state", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        scope,
        levelIndex,
        ts: Date.now(),
      });
      return;
    }

    logDebugClient("ws_reset_room_skipped", {
      roomId: roomId ?? null,
      hasUser: Boolean(effectiveIdentity),
      hasClientId: Boolean(clientIdRef.current),
      scope,
      levelIndex: Number.isInteger(levelIndex) ? levelIndex : null,
    });
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendProgressSync = useCallback((progressData: Record<string, unknown>) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("progress-sync", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        progressData,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendLevelMetaUpdate = useCallback((
    operation: LevelMetaOperation,
    opts?: { levelIndex?: number; fields?: Record<string, unknown>; level?: Record<string, unknown> }
  ) => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("level-meta-update", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        operation,
        ...(Number.isInteger(opts?.levelIndex) ? { levelIndex: opts!.levelIndex } : {}),
        ...(opts?.fields ? { fields: opts.fields } : {}),
        ...(opts?.level ? { level: opts.level } : {}),
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendGroupStartReady = useCallback(() => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("group-start-ready", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userEmail: effectiveIdentity.email,
        userName: effectiveIdentity.name,
        userImage: effectiveIdentity.image,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendGroupStartUnready = useCallback(() => {
    if (roomId && effectiveIdentity && clientIdRef.current) {
      sendMessage("group-start-unready", {
        roomId,
        groupId: parsedGroupId ?? undefined,
        clientId: clientIdRef.current,
        userId: effectiveIdentity.id,
        userEmail: effectiveIdentity.email,
        userName: effectiveIdentity.name,
        userImage: effectiveIdentity.image,
        ts: Date.now(),
      });
    }
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  const sendLobbyChat = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !roomId || !effectiveIdentity || !clientIdRef.current) {
      return;
    }
    sendMessage("lobby-chat-send", {
      roomId,
      clientId: clientIdRef.current,
      userId: effectiveIdentity.id,
      userEmail: effectiveIdentity.email,
      userName: effectiveIdentity.name,
      userImage: effectiveIdentity.image,
      text: trimmed,
      ts: Date.now(),
    });
  }, [effectiveIdentity, roomId, sendMessage]);


  /**
   * COLLABORATION STEP 16.1:
   * Periodically report a compact fingerprint of the current editor contents so
   * the server can detect when two collaborators silently drift apart.
   */
  const sendClientStateHash = useCallback((message: Omit<ClientStateHashMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => {
    logCollaborationStep("16.1", "sendClientStateHash", {
      roomId,
      editorType: message.editorType,
      levelIndex: message.levelIndex,
    });
    if (!roomId || !effectiveIdentity || !clientIdRef.current) {
      return;
    }
    sendMessage("client-state-hash", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      clientId: clientIdRef.current,
      userId: effectiveIdentity.id,
      userEmail: effectiveIdentity.email,
      engine: "yjs",
      ...message,
      ts: Date.now(),
    } satisfies ClientStateHashMessage);
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  /**
   * COLLABORATION STEP 16.2:
   * Send diagnostic breadcrumbs about stalls, blocked editors, or long tasks so
   * the server has extra evidence when collaboration feels unhealthy.
   */
  const sendClientHealthEvent = useCallback((message: Omit<ClientHealthEventMessage, "roomId" | "groupId" | "clientId" | "userId" | "userEmail" | "engine" | "ts">) => {
    logCollaborationStep("16.2", "sendClientHealthEvent", {
      roomId,
      eventType: message.eventType,
      severity: message.severity,
    });
    if (!roomId || !effectiveIdentity || !clientIdRef.current) {
      return;
    }
    sendMessage("client-health-event", {
      roomId,
      groupId: parsedGroupId ?? undefined,
      clientId: clientIdRef.current,
      userId: effectiveIdentity.id,
      userEmail: effectiveIdentity.email,
      engine: "yjs",
      ...message,
      ts: Date.now(),
    } satisfies ClientHealthEventMessage);
  }, [effectiveIdentity, parsedGroupId, roomId, sendMessage]);

  /**
   * COLLABORATION STEP 18.2:
   * Re-open the socket on demand after a manual retry or recovery flow.
   */
  const connect = useCallback(() => {
    logCollaborationStep("18.2", "connect", {
      roomId,
    });
    manualDisconnectRef.current = false;
    if (initialConnectTimeoutRef.current) {
      clearTimeout(initialConnectTimeoutRef.current);
      initialConnectTimeoutRef.current = null;
    }
    if (!socketRef.current) {
      reconnectFnRef.current?.();
    }
  }, []);

  const reconnectWithRole = useCallback((nextRole: "active" | "readonly") => {
    console.log(`[ws-lifecycle] reconnectWithRole room=${roomId} role=${nextRole}`);
    sessionRoleRef.current = nextRole;
    skipNextReconnectRecoveryRef.current = true;
    setSessionRole(nextRole);
    setIsSessionEvicted(false);
    manualDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;
    if (initialConnectTimeoutRef.current) {
      clearTimeout(initialConnectTimeoutRef.current);
      initialConnectTimeoutRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connectInFlightRef.current = false;
    // Clean up any lingering socket before reconnecting
    if (socketRef.current) {
      socketRef.current.onopen = null;
      socketRef.current.onmessage = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      try { socketRef.current.close(); } catch { /* ignore */ }
      socketRef.current = null;
      setSocketState(null);
    }
    isConnectedRef.current = false;
    setIsConnected(false);
    setIsConnecting(false);
    reconnectFnRef.current?.();
  }, [roomId]);

  const consumeSkipNextReconnectRecovery = useCallback(() => {
    const shouldSkip = skipNextReconnectRecoveryRef.current;
    skipNextReconnectRecoveryRef.current = false;
    return shouldSkip;
  }, []);

  const reclaimSession = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Socket is alive (we were demoted in-place) — just swap roles server-side.
      // No reconnect, no Yjs resync needed.
      sendMessage("reclaim-session", { roomId });
    } else {
      // Socket is gone (network failure during demotion window) — fall back to reconnect.
      reconnectWithRole("active");
    }
  }, [reconnectWithRole, roomId, sendMessage]);

  const connectReadOnly = useCallback(() => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Already connected as readonly after demotion — just dismiss the conflict UI.
      setIsSessionEvicted(false);
    } else {
      reconnectWithRole("readonly");
    }
  }, [reconnectWithRole]);

  return {
    socket: socketState,
    isConnected,
    isConnecting,
    error,
    isSessionEvicted,
    sessionRole,
    reclaimSession,
    connectReadOnly,
    consumeSkipNextReconnectRecovery,
    clientId,
    connect,
    disconnect,
    joinGame: () => {},
    leaveGame,
    sendCanvasCursor,
    requestRoomStateSync,
    sendYjsProtocol,
    sendRoomReset,
    sendProgressSync,
    sendGroupStartReady,
    sendGroupStartUnready,
    sendLobbyChat,
    sendClientStateHash,
    sendClientHealthEvent,
    sendLevelMetaUpdate,
    effectiveIdentity,
  };
}
