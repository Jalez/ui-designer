"use client";

import React, { createContext, useContext, useCallback, useMemo, useState, useEffect } from "react";
import * as Y from "yjs";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import {
  ActiveUser,
  CanvasCursor,
  CollaborationHealthMessage,
  CollaborationHealthSeverity,
  EditorCursor,
  EditorWatchdogSnapshot,
  GroupStartGateState,
  GroupStartSyncMessage,
  LobbyChatEntry,
  LobbyChatSyncMessage,
  ProgressSyncMessage,
  RoomStateSyncMessage,
  UserIdentity,
  EditorType,
  GameInstancesResetMessage,
  LevelMetaUpdateMessage,
  LevelMetaOperation,
} from "./types";
import { useCollaborationConnection } from "./hooks/useCollaborationConnection";
import { useCollaborationCursor } from "./hooks/useCollaborationCursor";
import { useCollaborationPresence } from "./hooks/useCollaborationPresence";
import { logCollaborationStep } from "./logCollaborationStep";
import { extractGroupIdFromRoomId, generateUserColor, isLobbyRoom } from "./utils";
import { decodeBase64ToUint8Array, encodeUint8ArrayToBase64 } from "./yjs-base64";

export type RoomStateSync = RoomStateSyncMessage | null;
export type ProgressSync = ProgressSyncMessage | null;
export type GroupStartSync = GroupStartSyncMessage | null;
export type GameInstancesResetSync = GameInstancesResetMessage | null;
export interface RemoteCodeChange {
  seq: number;
  editorType: EditorType;
  changeSetJson: unknown;
  levelIndex: number;
  baseVersion: number;
  nextVersion: number;
  clientId: string;
  ts: number;
}
export interface RemoteCodeResync {
  seq: number;
  editorType: EditorType;
  levelIndex: number;
  content: string;
  version: number;
  ts: number;
}
export interface LocalCodeAck {
  seq: number;
  editorType: EditorType;
  levelIndex: number;
  nextVersion: number;
  content: string;
  ts: number;
}

const EDITOR_HASH_INTERVAL_MS = 2000;
const STALL_DETECTION_WINDOW_MS = 6000;
const STALL_RETRY_COOLDOWN_MS = 10000;
const LONG_TASK_WARN_MS = 700;
const DIVERGENCE_RECOVERY_WINDOW_MS = 5000;
const EMPTY_REMOTE_CODE_CHANGES: RemoteCodeChange[] = [];
const EMPTY_REMOTE_CODE_RESYNCS: RemoteCodeResync[] = [];
const EMPTY_LOCAL_CODE_ACKS: LocalCodeAck[] = [];

type LocalEditorWatchState = EditorWatchdogSnapshot & {
  contentHash: string;
  contentLength: number;
  lastObservedAt: number;
  lastHashSentAt: number;
  lastLocalInputAt: number;
  lastRemoteApplyAt: number;
  lastStallEventAt: number;
};

/**
 * COLLABORATION STEP 16.3:
 * Build a stable key for one editor pane inside one level so watchdog, health,
 * and divergence tracking always talk about the same logical editing surface.
 */
function getEditorWatchKey(editorType: EditorType, levelIndex: number): string {
  logCollaborationStep("16.3", "getEditorWatchKey", {
    editorType,
    levelIndex,
  });
  return `${levelIndex}:${editorType}`;
}

/**
 * COLLABORATION STEP 16.4:
 * Turn the current editor text into a short fingerprint. We use this instead of
 * sending full code during health checks so clients can cheaply compare state.
 */
function hashContent(content: string): string {
  logCollaborationStep("16.4", "hashContent", {
    contentLength: content.length,
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * COLLABORATION STEP 5.1:
 * Compare two selections so awareness updates only go out when the cursor really
 * moved, instead of spamming the network with identical position payloads.
 */
function sameSelection(
  left: { from: number; to: number } | null | undefined,
  right: { from: number; to: number } | null | undefined,
): boolean {
  logCollaborationStep("5.1", "sameSelection", {
    leftFrom: left?.from ?? null,
    leftTo: left?.to ?? null,
    rightFrom: right?.from ?? null,
    rightTo: right?.to ?? null,
  });
  if (!left && !right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return left.from === right.from && left.to === right.to;
}

function areEditorCursorsEqual(
  left: Map<string, EditorCursor>,
  right: Map<string, EditorCursor>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const [key, leftCursor] of left.entries()) {
    const rightCursor = right.get(key);
    if (!rightCursor) {
      return false;
    }

    if (
      leftCursor.roomId !== rightCursor.roomId
      || leftCursor.groupId !== rightCursor.groupId
      || leftCursor.editorType !== rightCursor.editorType
      || leftCursor.levelIndex !== rightCursor.levelIndex
      || leftCursor.clientId !== rightCursor.clientId
      || leftCursor.userId !== rightCursor.userId
      || leftCursor.userName !== rightCursor.userName
      || leftCursor.color !== rightCursor.color
      || leftCursor.sessionRole !== rightCursor.sessionRole
      || !sameSelection(leftCursor.selection, rightCursor.selection)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * COLLABORATION STEP 2.1:
 * Inspect a room snapshot to see whether the group session has already started.
 * This lets the client infer missing gate state from the synchronized level data.
 */
function hasSharedStartTime(roomState: RoomStateSync): boolean {
  logCollaborationStep("2.1", "hasSharedStartTime", {
    hasRoomState: Boolean(roomState),
  });
  const firstLevel = roomState?.levels?.[0];
  const timeData =
    firstLevel && typeof firstLevel === "object" && firstLevel.timeData && typeof firstLevel.timeData === "object"
      ? (firstLevel.timeData as Record<string, unknown>)
      : null;
  return Number(timeData?.startTime ?? 0) > 0;
}

/**
 * COLLABORATION STEP 2.2:
 * Normalize the group-start gate from server data into a predictable frontend
 * shape so the rest of the provider can reason about collaboration state safely.
 */
function normalizeGroupStartGateFromRoomState(roomState: RoomStateSync): GroupStartGateState | null {
  logCollaborationStep("2.2", "normalizeGroupStartGateFromRoomState", {
    hasRoomState: Boolean(roomState),
  });
  const candidate = roomState?.groupStartGate;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const readyUserIds = Array.isArray(candidate.readyUserIds)
    ? candidate.readyUserIds.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
    : [];
  const rawReadyUsers =
    candidate.readyUsers && typeof candidate.readyUsers === "object" && !Array.isArray(candidate.readyUsers)
      ? candidate.readyUsers
      : {};

  return {
    status: candidate.status === "started" ? "started" : "waiting",
    minReadyCount:
      typeof candidate.minReadyCount === "number" && Number.isFinite(candidate.minReadyCount)
        ? candidate.minReadyCount
        : 2,
    readyUserIds,
    readyUsers: readyUserIds.reduce<Record<string, GroupStartGateState["readyUsers"][string]>>((acc, userId) => {
      const readyUser = rawReadyUsers[userId];
      acc[userId] = {
        userId,
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.userName === "string"
          ? { userName: readyUser.userName }
          : {}),
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.userEmail === "string"
          ? { userEmail: readyUser.userEmail }
          : {}),
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.userImage === "string"
          ? { userImage: readyUser.userImage }
          : {}),
        ...(readyUser && typeof readyUser === "object" && !Array.isArray(readyUser) && typeof readyUser.readyAt === "string"
          ? { readyAt: readyUser.readyAt }
          : {}),
      };
      return acc;
    }, {}),
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : null,
    startedByUserId: typeof candidate.startedByUserId === "string" ? candidate.startedByUserId : null,
  };
}

export interface CollaborationContextValue {
  collabEngine: "yjs";
  isYjsEnabled: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  isSessionEvicted: boolean;
  reclaimSession: () => void;
  connectReadOnly: () => void;
  sessionRole: "active" | "readonly";
  roomId: string | null;
  groupId: string | null;
  clientId: string | null;
  effectiveIdentity: UserIdentity | null;
  activeUsers: ActiveUser[];
  usersByTab: Record<EditorType, ActiveUser[]>;
  remoteCursors: Map<string, CanvasCursor>;
  editorCursors: Map<string, EditorCursor>;
  remoteCodeChanges: RemoteCodeChange[];
  remoteCodeResyncs: RemoteCodeResync[];
  localCodeAcks: LocalCodeAck[];
  lastProgressSync: ProgressSync;
  lastGameInstancesReset: GameInstancesResetSync;
  groupStartGate: GroupStartGateState | null;
  lobbyMessages: LobbyChatEntry[];
  initialRoomState: RoomStateSync;
  lastHealthMessage: CollaborationHealthMessage | null;
  lastLevelMetaUpdate: LevelMetaUpdateMessage | null;
  codeSyncReady: boolean;
  yjsReady: boolean;
  yjsDocGeneration: number;
  updateCanvasCursor: (x: number, y: number) => void;
  updateEditorSelection: (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => void;
  applyEditorChange: (
    editorType: EditorType,
    changeSetJson: unknown,
    levelIndex: number,
    baseVersion: number,
    selection?: { from: number; to: number }
  ) => void;
  getEditorVersion: (editorType: EditorType, levelIndex: number) => number;
  setActiveTab: (editorType: EditorType, levelIndex: number) => void;
  setTyping: (editorType: EditorType, levelIndex: number, isTyping: boolean) => void;
  resetRoomState: (scope: "level" | "game", levelIndex?: number) => void;
  syncProgressData: (progressData: Record<string, unknown>) => void;
  setGroupReady: (isReady: boolean) => void;
  sendLobbyChat: (text: string) => void;
  sendLevelMetaUpdate: (operation: LevelMetaOperation, opts?: { levelIndex?: number; fields?: Record<string, unknown>; level?: Record<string, unknown> }) => void;
  reportEditorWatchState: (snapshot: EditorWatchdogSnapshot) => void;
  reportCollaborationHealthEvent: (
    eventType: string,
    severity: CollaborationHealthSeverity,
    details?: Record<string, unknown>,
    scope?: { editorType?: EditorType; levelIndex?: number }
  ) => void;
  getYText: (editorType: EditorType, levelIndex: number) => Y.Text | null;
  getYCodeSnapshot: (editorType: EditorType, levelIndex: number) => string | null;
  getYSolutionText: (editorType: EditorType, levelIndex: number) => Y.Text | null;
  getYSolutionSnapshot: (editorType: EditorType, levelIndex: number) => string | null;
  connect: () => void;
  disconnect: () => void;
}

export const CollaborationContext = createContext<CollaborationContextValue | null>(null);

interface CollaborationProviderProps {
  children: React.ReactNode;
  roomId?: string | null;
  groupId?: string | null;
  user: UserIdentity | null;
}

export function CollaborationProvider({ children, roomId, groupId, user }: CollaborationProviderProps) {
  const collabEngine = "yjs" as const;
  const resolvedRoomId = roomId ?? groupId ?? null;
  const isLobbyRoomId = isLobbyRoom(resolvedRoomId);
  const isYjsEnabled = !isLobbyRoomId;
  const resolvedGroupId = groupId ?? extractGroupIdFromRoomId(resolvedRoomId);
  const [canvasCursors, setCanvasCursors] = useState<Map<string, CanvasCursor>>(new Map());
  const [editorCursors, setEditorCursors] = useState<Map<string, EditorCursor>>(new Map());
  const remoteCodeChanges = EMPTY_REMOTE_CODE_CHANGES;
  const remoteCodeResyncs = EMPTY_REMOTE_CODE_RESYNCS;
  const localCodeAcks = EMPTY_LOCAL_CODE_ACKS;
  const [lastProgressSync, setLastProgressSync] = useState<ProgressSync>(null);
  const [lastGameInstancesReset, setLastGameInstancesReset] = useState<GameInstancesResetSync>(null);
  const [groupStartGate, setGroupStartGate] = useState<GroupStartGateState | null>(null);
  const [lobbyMessages, setLobbyMessages] = useState<LobbyChatEntry[]>([]);
  const [initialRoomState, setInitialRoomState] = useState<RoomStateSync>(null);
  const [lastHealthMessage, setLastHealthMessage] = useState<CollaborationHealthMessage | null>(null);
  const [lastLevelMetaUpdate, setLastLevelMetaUpdate] = useState<LevelMetaUpdateMessage | null>(null);
  const [codeSyncReady, setCodeSyncReady] = useState(false);
  const [yjsReady, setYjsReady] = useState(false);
  const [yjsDocGeneration, setYjsDocGeneration] = useState(0);
  const wasConnectedRef = React.useRef(false);
  const hasConnectedOnceRef = React.useRef(false);
  const hasDisconnectedUnexpectedlyRef = React.useRef(false);
  const yDocRef = React.useRef<Y.Doc | null>(null);
  const yAwarenessRef = React.useRef<awarenessProtocol.Awareness | null>(null);
  const serverYjsDocGenerationRef = React.useRef(0);
  const editorWatchStatesRef = React.useRef<Map<string, LocalEditorWatchState>>(new Map());
  const lastTransportMessageAtRef = React.useRef(0);
  const localActiveEditorRef = React.useRef<{ editorType: EditorType; levelIndex: number } | null>(null);
  const lastHealthEventAtRef = React.useRef<Map<string, number>>(new Map());
  const divergenceRecoveryRef = React.useRef<Map<string, { retriedAt: number }>>(new Map());
  const pendingAwarenessStateRef = React.useRef<Record<string, unknown> | null>(null);
  const hasPendingAwarenessStateRef = React.useRef(false);
  const awarenessFlushScheduledRef = React.useRef(false);
  /** While false, do not forward local Y.Doc updates over the socket (prevents duplicate merges during reconnect). */
  const yjsDocOutboundAllowedRef = React.useRef(false);

  useEffect(() => {
    console.log(`[collab-loop] CollaborationProvider roomId=${roomId} groupId=${groupId}`);
  }, [groupId, roomId]);

  /**
   * COLLABORATION STEP 13.1:
   * Record that a remote change just landed in one editor, or across all editors.
   * The watchdog uses this timestamp later to tell the difference between a healthy
   * quiet period and a suspicious "other people are typing but I am not updating" stall.
   */
  const markEditorRemoteApply = useCallback((editorType?: EditorType, levelIndex?: number) => {
    logCollaborationStep("13.1", "markEditorRemoteApply", {
      editorType: editorType ?? null,
      levelIndex: levelIndex ?? null,
    });
    const now = Date.now();
    if (editorType && Number.isInteger(levelIndex)) {
      const key = getEditorWatchKey(editorType, levelIndex);
      const existing = editorWatchStatesRef.current.get(key);
      if (existing) {
        editorWatchStatesRef.current.set(key, {
          ...existing,
          lastRemoteApplyAt: now,
          lastObservedAt: now,
        });
      }
      return;
    }

    editorWatchStatesRef.current.forEach((state, key) => {
      editorWatchStatesRef.current.set(key, {
        ...state,
        lastRemoteApplyAt: now,
        lastObservedAt: now,
      });
    });
  }, []);

  /**
   * COLLABORATION STEP 3.1:
   * Derive the shared Yjs document key for one editor in one level so both the
   * frontend and backend can point at the exact same collaborative text slot.
   */
  const getYTextKey = useCallback((editorType: EditorType, levelIndex: number) => {
    logCollaborationStep("3.1", "getYTextKey", {
      editorType,
      levelIndex,
    });
    return `level:${levelIndex}:${editorType}`;
  }, []);

  const getYSolutionTextKey = useCallback((editorType: EditorType, levelIndex: number) => {
    logCollaborationStep("3.1", "getYSolutionTextKey", {
      editorType,
      levelIndex,
    });
    return `level:${levelIndex}:solution:${editorType}`;
  }, []);

  /**
   * COLLABORATION STEP 3.2:
   * Fetch the live shared Yjs text object that backs a specific editor tab.
   * This is the CRDT source of truth that CodeMirror binds to.
   */
  const getYText = useCallback((editorType: EditorType, levelIndex: number) => {
    logCollaborationStep("3.2", "getYText", {
      editorType,
      levelIndex,
      hasDoc: Boolean(yDocRef.current),
    });
    const doc = yDocRef.current;
    if (!doc) {
      return null;
    }
    return doc.getText(getYTextKey(editorType, levelIndex));
  }, [getYTextKey]);

  const getYSolutionText = useCallback((editorType: EditorType, levelIndex: number) => {
    logCollaborationStep("3.2", "getYSolutionText", {
      editorType,
      levelIndex,
      hasDoc: Boolean(yDocRef.current),
    });
    const doc = yDocRef.current;
    if (!doc) {
      return null;
    }
    return doc.getText(getYSolutionTextKey(editorType, levelIndex));
  }, [getYSolutionTextKey]);

  /**
   * COLLABORATION STEP 14.1:
   * Read the current shared text as a plain string when something outside the
   * editor UI needs a plain snapshot of the canonical collaborative code.
   */
  const getYCodeSnapshot = useCallback((editorType: EditorType, levelIndex: number) => {
    logCollaborationStep("14.1", "getYCodeSnapshot", {
      editorType,
      levelIndex,
    });
    return getYText(editorType, levelIndex)?.toString() ?? null;
  }, [getYText]);

  const getYSolutionSnapshot = useCallback((editorType: EditorType, levelIndex: number) => {
    logCollaborationStep("14.1", "getYSolutionSnapshot", {
      editorType,
      levelIndex,
    });
    return getYSolutionText(editorType, levelIndex)?.toString() ?? null;
  }, [getYSolutionText]);

  /**
   * COLLABORATION STEP 5.2:
   * Read the most up-to-date local awareness state, including queued edits that
   * have not been flushed yet, so presence patches always build on the newest draft.
   */
  const getQueuedOrCurrentLocalAwarenessState = useCallback(() => {
    logCollaborationStep("5.2", "getQueuedOrCurrentLocalAwarenessState");
    if (hasPendingAwarenessStateRef.current) {
      return pendingAwarenessStateRef.current;
    }
    const awareness = yAwarenessRef.current;
    return (awareness?.getLocalState() as Record<string, unknown> | null | undefined) ?? null;
  }, []);

  /**
   * COLLABORATION STEP 5.3:
   * Queue local awareness changes into a microtask so rapid cursor and typing
   * updates collapse into one clean state push instead of many tiny broadcasts.
   */
  const queueLocalAwarenessState = useCallback((nextState: Record<string, unknown> | null) => {
    logCollaborationStep("5.3", "queueLocalAwarenessState", {
      hasNextState: Boolean(nextState),
    });
    if (!yAwarenessRef.current) {
      return;
    }
    pendingAwarenessStateRef.current = nextState;
    hasPendingAwarenessStateRef.current = true;
    if (awarenessFlushScheduledRef.current) {
      return;
    }
    awarenessFlushScheduledRef.current = true;
    queueMicrotask(() => {
      awarenessFlushScheduledRef.current = false;
      const awareness = yAwarenessRef.current;
      if (!awareness || !hasPendingAwarenessStateRef.current) {
        return;
      }
      const flushedState = pendingAwarenessStateRef.current;
      hasPendingAwarenessStateRef.current = false;
      pendingAwarenessStateRef.current = null;
      awareness.setLocalState(flushedState);
    });
  }, []);

  /**
   * COLLABORATION STEP 2.3:
   * Rebuild the local Yjs document shell when the room changes or the server says
   * a new document generation exists. In plain terms, this gives the editor a fresh
   * shared notebook, prefilled from the last known room snapshot to avoid flashing blank.
   */
  const replaceLocalYDoc = useCallback((reason: string, nextServerGeneration?: number | null, hydrateFrom?: RoomStateSync) => {
    console.log(`[collab-loop] replaceLocalYDoc reason=${reason} nextGen=${nextServerGeneration ?? "null"} hydratedLevels=${hydrateFrom?.levels?.length ?? 0}`);
    logCollaborationStep("2.3", "replaceLocalYDoc", {
      reason,
      nextServerGeneration: nextServerGeneration ?? null,
      hydratedLevels: hydrateFrom?.levels?.length ?? 0,
    });
    const previousDoc = yDocRef.current;
    if (previousDoc) {
      previousDoc.destroy();
    }
    const previousAwareness = yAwarenessRef.current;
    if (previousAwareness) {
      previousAwareness.destroy();
    }

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    hasPendingAwarenessStateRef.current = false;
    pendingAwarenessStateRef.current = null;
    awarenessFlushScheduledRef.current = false;
    awareness.setLocalState(null);
    yDocRef.current = doc;
    yAwarenessRef.current = awareness;
    if (Number.isInteger(nextServerGeneration) && typeof nextServerGeneration === "number") {
      serverYjsDocGenerationRef.current = nextServerGeneration;
    }

    // IMPORTANT: Do NOT pre-hydrate the local Y.Doc with plain-text inserts.
    // Doing so creates local Yjs items that can later merge with the server's
    // canonical items during SyncStep2, producing duplicated/interleaved content.
    // We instead keep the doc empty until the first authoritative server sync lands.

    doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote-yjs" || origin === "hydrate-local") {
        return;
      }
      if (!yjsDocOutboundAllowedRef.current) {
        return;
      }

      const encoder = encoding.createEncoder();
      syncProtocol.writeUpdate(encoder, update);
      sendYjsProtocolRef.current?.({
        channel: "sync",
        payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
        yjsDocGeneration: serverYjsDocGenerationRef.current,
      });
    });

    awareness.on("update", ({ added, updated, removed }, origin) => {
      if (origin === "remote-yjs-awareness") {
        return;
      }
      const changedClients = added.concat(updated, removed);
      if (changedClients.length === 0) {
        return;
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients));
      sendYjsProtocolRef.current?.({
        channel: "awareness",
        payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
        yjsDocGeneration: serverYjsDocGenerationRef.current,
      });
    });

    setYjsReady(false);
    yjsDocOutboundAllowedRef.current = false;
    setYjsDocGeneration((prev) => prev + 1);
    console.log("[yjs-doc:replace]", {
      roomId: resolvedRoomId,
      reason,
      serverGeneration: serverYjsDocGenerationRef.current,
      hydrated: Boolean(hydrateFrom?.levels),
    });
    // #region agent log
    fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "02d82b" },
      body: JSON.stringify({
        sessionId: "02d82b",
        location: "CollaborationProvider.tsx:replaceLocalYDoc",
        message: "replaceLocalYDoc",
        data: { reason, serverGen: serverYjsDocGenerationRef.current, hypothesisId: "H1" },
        timestamp: Date.now(),
        hypothesisId: "H1",
      }),
    }).catch(() => {});
    // #endregion
  }, [resolvedRoomId]);

  // Presence helpers — populated after useCollaborationPresence is called below
  const addUserRef = React.useRef<((u: ActiveUser) => void) | null>(null);
  const setUsersRef = React.useRef<((u: ActiveUser[]) => void) | null>(null);
  const removeUserRef = React.useRef<((identity: { clientId?: string; userId?: string }) => void) | null>(null);
  const sendYjsProtocolRef = React.useRef<((message: { channel: "sync" | "awareness"; payloadBase64: string; yjsDocGeneration?: number }) => void) | null>(null);

  // Queue presence events that arrive before refs are set (e.g. fast current-users after join)
  const pendingPresenceRef = React.useRef<Array<{ type: "user-joined"; user: ActiveUser } | { type: "current-users"; users: ActiveUser[] }>>([]);

  /**
   * COLLABORATION STEP 15.12:
   * Replay presence events that arrived before the presence store finished wiring
   * itself up, so fast join snapshots are not lost during initial render timing.
   */
  const flushPendingPresence = useCallback(() => {
    logCollaborationStep("15.12", "flushPendingPresence", {
      pendingCount: pendingPresenceRef.current.length,
    });
    const addUser = addUserRef.current;
    const setUsers = setUsersRef.current;
    if (!addUser && !setUsers) return;
    const pending = pendingPresenceRef.current;
    if (pending.length === 0) return;
    pendingPresenceRef.current = [];
    for (const event of pending) {
      if (event.type === "current-users" && setUsers) setUsers(event.users);
      if (event.type === "user-joined" && addUser) addUser(event.user);
    }
  }, []);

  /**
   * COLLABORATION STEP 15.13:
   * Forward one newly joined collaborator into the local presence store, or queue
   * it briefly if the store is not ready yet.
   */
  const handleUserJoined = useCallback((joinedUser: ActiveUser) => {
    logCollaborationStep("15.13", "handleUserJoined", {
      clientId: joinedUser.clientId,
      userId: joinedUser.userId,
    });
    if (addUserRef.current) {
      addUserRef.current(joinedUser);
    } else {
      pendingPresenceRef.current.push({ type: "user-joined", user: joinedUser });
    }
  }, []);

  /**
   * COLLABORATION STEP 15.14:
   * Accept the server's authoritative user list for the room during join and
   * reconnect flows so presence starts from a full roster instead of drip-feeding.
   */
  const handleCurrentUsers = useCallback((users: ActiveUser[]) => {
    logCollaborationStep("15.14", "handleCurrentUsers", {
      userCount: users.length,
    });
    if (setUsersRef.current) {
      setUsersRef.current(users);
    } else {
      pendingPresenceRef.current.push({ type: "current-users", users });
    }
  }, []);

  /**
   * COLLABORATION STEP 19.9:
   * Remove a departing collaborator from every local mirror we keep: user roster,
   * canvas cursors, and editor carets. This prevents ghosts after disconnects.
   */
  const handleUserLeftId = useCallback(({ clientId, userId }: { clientId?: string; userId?: string }) => {
    logCollaborationStep("19.9", "handleUserLeftId", {
      clientId: clientId ?? null,
      userId: userId ?? null,
    });
    removeUserRef.current?.({ clientId, userId });
    setCanvasCursors((prev) => {
      const next = new Map(prev);
      for (const [key, cursor] of next.entries()) {
        if ((clientId && cursor.clientId === clientId) || (!clientId && userId && cursor.userId === userId)) {
          next.delete(key);
        }
      }
      return next;
    });
    setEditorCursors((prev) => {
      const next = new Map(prev);
      for (const [key, cursor] of next.entries()) {
        if ((clientId && cursor.clientId === clientId) || (!clientId && userId && cursor.userId === userId)) {
          next.delete(key);
        }
      }
      return next;
    });
  }, []);

  /**
   * COLLABORATION STEP 19.10:
   * Normalize "user left" transport payloads into the identity shape used by
   * local cleanup logic.
   */
  const handleUserLeft = useCallback((leftUser: { clientId?: string; userId: string; userEmail: string; userName?: string }) => {
    logCollaborationStep("19.10", "handleUserLeft", {
      clientId: leftUser.clientId ?? null,
      userId: leftUser.userId,
    });
    handleUserLeftId({ clientId: leftUser.clientId, userId: leftUser.userId });
  }, [handleUserLeftId]);

  /**
   * COLLABORATION STEP 15.15:
   * Update the shared canvas cursor cache when a remote collaborator moves around
   * outside the code editor.
   */
  const handleCanvasCursor = useCallback((cursor: CanvasCursor) => {
    logCollaborationStep("15.15", "handleCanvasCursor", {
      clientId: cursor.clientId,
      userId: cursor.userId,
    });
    setCanvasCursors((prev) => {
      const next = new Map(prev);
      next.set(cursor.clientId, cursor);
      return next;
    });
  }, []);
  const getEditorVersion = useCallback(() => 0, []);

  /**
   * COLLABORATION STEP 2.4:
   * Apply the server's room snapshot. This seeds initial state, reconciles start
   * gate information, and swaps the local Yjs document if the server generation changed.
   */
  const handleRoomStateSync = useCallback((roomState: RoomStateSyncMessage) => {
    console.log(`[collab-loop] handleRoomStateSync levelsCount=${roomState?.levels?.length ?? 0} forceReplace=${roomState?.forceReplaceYDoc === true}`);
    logCollaborationStep("2.4", "handleRoomStateSync", {
      yjsDocGeneration: roomState?.yjsDocGeneration ?? null,
      levelsCount: roomState?.levels?.length ?? 0,
      forceReplaceYDoc: roomState?.forceReplaceYDoc === true,
    });
    markEditorRemoteApply();
    setInitialRoomState(roomState);
    const roomGate = normalizeGroupStartGateFromRoomState(roomState);
    const inferredStarted = hasSharedStartTime(roomState);
    if (roomGate?.status === "started") {
      setGroupStartGate(roomGate);
    } else if (inferredStarted) {
      setGroupStartGate((prev) => ({
        status: "started",
        minReadyCount: roomGate?.minReadyCount ?? prev?.minReadyCount ?? 2,
        readyUserIds: roomGate?.readyUserIds ?? prev?.readyUserIds ?? [],
        readyUsers: roomGate?.readyUsers ?? prev?.readyUsers ?? {},
        startedAt: roomGate?.startedAt ?? prev?.startedAt ?? new Date().toISOString(),
        startedByUserId: roomGate?.startedByUserId ?? prev?.startedByUserId ?? null,
      }));
    } else if (roomGate) {
      setGroupStartGate(roomGate);
    }
    const nextGeneration = Number.isInteger(roomState.yjsDocGeneration) ? roomState.yjsDocGeneration ?? 0 : 0;
    if (
      !yDocRef.current
      || nextGeneration !== serverYjsDocGenerationRef.current
      || roomState.forceReplaceYDoc === true
    ) {
      const hasForcedYjsSyncPayload = typeof roomState.forceReplaceYjsSyncPayloadBase64 === "string"
        && roomState.forceReplaceYjsSyncPayloadBase64.length > 0;
      replaceLocalYDoc(
        roomState.forceReplaceYDoc === true ? "room_state_forced_recovery" : "room_state_generation",
        nextGeneration,
        roomState.forceReplaceYDoc === true && hasForcedYjsSyncPayload ? null : roomState,
      );
      if (roomState.forceReplaceYDoc === true) {
        if (hasForcedYjsSyncPayload) {
          const doc = yDocRef.current;
          if (doc) {
            const decoder = decoding.createDecoder(
              decodeBase64ToUint8Array(roomState.forceReplaceYjsSyncPayloadBase64 as string),
            );
            const encoder = encoding.createEncoder();
            const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, "remote-yjs");
            if (encoding.length(encoder) > 0) {
              sendYjsProtocolRef.current?.({
                channel: "sync",
                payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
                yjsDocGeneration: serverYjsDocGenerationRef.current,
              });
            }
            markEditorRemoteApply();
            if (syncMessageType !== syncProtocol.messageYjsSyncStep1) {
              setYjsReady(true);
            }
            // Only after SyncStep2: enabling doc outbound earlier (e.g. on SyncUpdate) lets local ops echo
            // during the Step1/Step2 handshake and merge duplicate document state (templates + solutions).
            if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
              yjsDocOutboundAllowedRef.current = true;
            }
          }
          queueMicrotask(() => {
            const doc = yDocRef.current;
            const sendYjsProtocol = sendYjsProtocolRef.current;
            if (!doc || !sendYjsProtocol) {
              return;
            }
            const encoder = encoding.createEncoder();
            syncProtocol.writeSyncStep1(encoder, doc);
            const payloadBase64 = encodeUint8ArrayToBase64(encoding.toUint8Array(encoder));
            console.log("[yjs-sync:step1]", {
              roomId: resolvedRoomId,
              reason: "room_state_forced_recovery_post_replace",
              serverGeneration: serverYjsDocGenerationRef.current,
              payloadLength: payloadBase64.length,
            });
            sendYjsProtocol({
              channel: "sync",
              payloadBase64,
              yjsDocGeneration: serverYjsDocGenerationRef.current,
            });
          });
        } else {
          setYjsReady(true);
          queueMicrotask(() => {
            const doc = yDocRef.current;
            const sendYjsProtocol = sendYjsProtocolRef.current;
            if (!doc || !sendYjsProtocol) {
              return;
            }
            const encoder = encoding.createEncoder();
            syncProtocol.writeSyncStep1(encoder, doc);
            const payloadBase64 = encodeUint8ArrayToBase64(encoding.toUint8Array(encoder));
            console.log("[yjs-sync:step1]", {
              roomId: resolvedRoomId,
              reason: "room_state_forced_recovery",
              serverGeneration: serverYjsDocGenerationRef.current,
              payloadLength: payloadBase64.length,
            });
            sendYjsProtocol({
              channel: "sync",
              payloadBase64,
              yjsDocGeneration: serverYjsDocGenerationRef.current,
            });
          });
        }
      }
    }
  }, [markEditorRemoteApply, replaceLocalYDoc, resolvedRoomId]);

  const handleProgressSync = useCallback((message: ProgressSyncMessage) => {
    setLastProgressSync(message);
  }, []);

  const handleGameInstancesReset = useCallback((message: GameInstancesResetMessage) => {
    setLastGameInstancesReset(message);
  }, []);

  const handleGroupStartSync = useCallback((message: GroupStartSyncMessage) => {
    setGroupStartGate(message.gate);
  }, []);

  const handleLobbyChatSync = useCallback((message: LobbyChatSyncMessage) => {
    setLobbyMessages(Array.isArray(message.messages) ? message.messages : []);
  }, []);

  const handleLobbyChatMessage = useCallback((message: LobbyChatEntry) => {
    setLobbyMessages((prev) => [...prev.slice(-99), message]);
  }, []);

  /**
   * COLLABORATION STEP 16.5:
   * Stamp the last time any collaboration traffic arrived so the watchdog can
   * detect suspicious periods of silence while editing is still happening.
   */
  const handleTransportMessage = useCallback(() => {
    logCollaborationStep("16.5", "handleTransportMessage");
    lastTransportMessageAtRef.current = Date.now();
  }, []);

  const handleCollaborationHealth = useCallback((message: CollaborationHealthMessage) => {
    setLastHealthMessage(message);
  }, []);

  const handleLevelMetaUpdate = useCallback((message: LevelMetaUpdateMessage) => {
    setLastLevelMetaUpdate(message);
  }, []);

  const handleSocketConnected = useCallback(() => {
    hasDisconnectedUnexpectedlyRef.current = false;
    lastTransportMessageAtRef.current = Date.now();
    // #region agent log
    fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "02d82b" },
      body: JSON.stringify({
        sessionId: "02d82b",
        location: "CollaborationProvider.tsx:handleSocketConnected",
        message: "socket_connected_before_yjs_reset",
        data: { roomId: resolvedRoomId, serverGen: serverYjsDocGenerationRef.current, hypothesisId: "H1" },
        timestamp: Date.now(),
        hypothesisId: "H1",
      }),
    }).catch(() => {});
    // #endregion
    // Defensive: reset the local Y.Doc on (re)connect to avoid merging divergent local items
    // with the server's canonical doc, which can manifest as duplicated/interleaved content.
    // The authoritative state will arrive via SyncStep2.
    if (isYjsEnabled && resolvedRoomId) {
      replaceLocalYDoc("socket_connected_reset", serverYjsDocGenerationRef.current);
    }
  }, [isYjsEnabled, replaceLocalYDoc, resolvedRoomId]);

  const handleSocketDisconnected = useCallback(() => {
    hasDisconnectedUnexpectedlyRef.current = true;
    lastTransportMessageAtRef.current = 0;
    editorWatchStatesRef.current.clear();
    setCodeSyncReady(false);
    setLastHealthMessage(null);
    setCanvasCursors(new Map());
    setEditorCursors(new Map());
  }, []);

  /**
   * COLLABORATION STEP 15.16:
   * Rebuild the visible collaborator roster and remote editor selections from the
   * raw Yjs awareness map. In plain terms, this translates CRDT presence into UI state.
   */
  const syncPresenceFromAwareness = useCallback(() => {
    logCollaborationStep("15.16", "syncPresenceFromAwareness");
    const awareness = yAwarenessRef.current;
    if (!awareness) {
      return;
    }
    const nextUsers: ActiveUser[] = [];
    const nextEditorCursors = new Map<string, EditorCursor>();
    const localState = awareness.getLocalState();
    const localClientId =
      localState && typeof localState === "object" && localState.session && typeof localState.session === "object" && typeof localState.session.clientId === "string"
        ? localState.session.clientId
        : "";
    for (const [, rawState] of awareness.getStates()) {
      if (!rawState || typeof rawState !== "object") {
        continue;
      }
      const session = rawState.session && typeof rawState.session === "object" ? rawState.session : null;
      const userState = rawState.user && typeof rawState.user === "object" ? rawState.user : null;
      const editor = rawState.editor && typeof rawState.editor === "object" ? rawState.editor : null;
      const awarenessClientId = typeof session?.clientId === "string" ? session.clientId : "";
      const awarenessRole = typeof session?.role === "string" && session.role === "readonly" ? "readonly" : "active";
      const userId = typeof userState?.id === "string" ? userState.id : "";
      if (!awarenessClientId || !userId) {
        continue;
      }
      if (localClientId && awarenessClientId === localClientId) {
        continue;
      }
      const editorType = editor?.editorType;
      const levelIndex = Number.isInteger(editor?.levelIndex) ? editor.levelIndex : undefined;
      const isTyping = editor?.isTyping === true;
      nextUsers.push({
        clientId: awarenessClientId,
        userId,
        userEmail: typeof userState?.email === "string" ? userState.email : "",
        userName: typeof userState?.name === "string" ? userState.name : undefined,
        userImage: typeof userState?.image === "string" ? userState.image : undefined,
        sessionRole: awarenessRole,
        activeTab: editorType === "html" || editorType === "css" || editorType === "js" ? editorType : undefined,
        activeLevelIndex: levelIndex,
        isTyping,
      });
      if (
        (editorType === "html" || editorType === "css" || editorType === "js")
        && Number.isInteger(levelIndex)
        && editor?.selection
        && typeof editor.selection === "object"
        && Number.isInteger(editor.selection.from)
        && Number.isInteger(editor.selection.to)
      ) {
        nextEditorCursors.set(`${awarenessClientId}-${editorType}-${levelIndex}`, {
          roomId: resolvedRoomId || "",
          groupId: resolvedGroupId || undefined,
          editorType,
          levelIndex,
          clientId: awarenessClientId,
          userId,
          userName: typeof userState?.name === "string" ? userState.name : undefined,
          color: generateUserColor(typeof userState?.email === "string" ? userState.email : awarenessClientId),
          sessionRole: awarenessRole,
          selection: {
            from: editor.selection.from,
            to: editor.selection.to,
          },
          ts: Date.now(),
        });
      }
    }
    setUsersRef.current?.(nextUsers);
    setEditorCursors((prev) => (areEditorCursorsEqual(prev, nextEditorCursors) ? prev : nextEditorCursors));
  }, [resolvedGroupId, resolvedRoomId]);

  /**
   * COLLABORATION STEP 12.2:
   * Apply incoming Yjs sync and awareness packets from the websocket transport.
   * This is the frontend entry point where remote document changes and presence
   * updates become part of the local collaborative session.
   */
  const handleYjsProtocol = useCallback((message: { channel: "sync" | "awareness"; payloadBase64: string; yjsDocGeneration?: number }) => {
    logCollaborationStep("12.2", "handleYjsProtocol", {
      channel: message.channel,
      payloadLength: message.payloadBase64.length,
      yjsDocGeneration: message.yjsDocGeneration ?? null,
    });
    const doc = yDocRef.current;
    if (!doc || !message.payloadBase64) {
      return;
    }
    if (
      Number.isInteger(message.yjsDocGeneration)
      && message.yjsDocGeneration !== serverYjsDocGenerationRef.current
    ) {
      console.log("[yjs-protocol:skip]", {
        roomId: resolvedRoomId,
        channel: message.channel,
        messageGeneration: message.yjsDocGeneration,
        localGeneration: serverYjsDocGenerationRef.current,
        reason: "generation_mismatch",
      });
      return;
    }
    if (message.channel === "awareness") {
      const awareness = yAwarenessRef.current;
      if (!awareness) {
        return;
      }
      const rawPayload = decodeBase64ToUint8Array(message.payloadBase64);
      const awarenessDecoder = decoding.createDecoder(rawPayload);
      const awarenessUpdate = decoding.readVarUint8Array(awarenessDecoder);
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        awarenessUpdate,
        "remote-yjs-awareness",
      );
      syncPresenceFromAwareness();
      return;
    }
    const decoder = decoding.createDecoder(decodeBase64ToUint8Array(message.payloadBase64));
    const encoder = encoding.createEncoder();
    const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, "remote-yjs");
    console.log(`[collab-loop] handleYjsProtocol syncMessageType=${syncMessageType} encoderLen=${encoding.length(encoder)} room=${resolvedRoomId}`);
    if (encoding.length(encoder) > 0) {
      sendYjsProtocolRef.current?.({
        channel: "sync",
        payloadBase64: encodeUint8ArrayToBase64(encoding.toUint8Array(encoder)),
        yjsDocGeneration: serverYjsDocGenerationRef.current,
      });
    }
    markEditorRemoteApply();
    if (syncMessageType !== syncProtocol.messageYjsSyncStep1) {
      setYjsReady(true);
    }
    if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
      yjsDocOutboundAllowedRef.current = true;
    }
    // #region agent log
    const d = yDocRef.current;
    if (d && message.channel === "sync") {
      const h = d.getText("level:0:solution:html").toString().length;
      const c = d.getText("level:0:solution:css").toString().length;
      const j = d.getText("level:0:solution:js").toString().length;
      const tplH = d.getText("level:0:html").toString().length;
      const tplC = d.getText("level:0:css").toString().length;
      const tplJ = d.getText("level:0:js").toString().length;
      fetch("http://127.0.0.1:7450/ingest/cb7bd925-d0ab-4436-a306-67218a1ee8e8", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "02d82b" },
        body: JSON.stringify({
          sessionId: "02d82b",
          location: "CollaborationProvider.tsx:handleYjsProtocol",
          message: "after_readSyncMessage",
          data: { syncMessageType, hLen: h, cLen: c, jLen: j, tplH, tplC, tplJ, hypothesisId: "H1" },
          timestamp: Date.now(),
          hypothesisId: "H1",
        }),
      }).catch(() => {});
    }
    // #endregion
  }, [markEditorRemoteApply, resolvedRoomId, syncPresenceFromAwareness]);

  const {
    isConnected,
    isConnecting,
    error,
    isSessionEvicted,
    sessionRole,
    reclaimSession,
    connectReadOnly,
    clientId,
    connect,
    disconnect,
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
  } = useCollaborationConnection({
    roomId: resolvedRoomId,
    user,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onConnected: handleSocketConnected,
    onDisconnected: handleSocketDisconnected,
    onCanvasCursor: handleCanvasCursor,
    onCurrentUsers: handleCurrentUsers,
    onRoomStateSync: handleRoomStateSync,
    onProgressSync: handleProgressSync,
    onGameInstancesReset: handleGameInstancesReset,
    onGroupStartSync: handleGroupStartSync,
    onLobbyChatSync: handleLobbyChatSync,
    onLobbyChatMessage: handleLobbyChatMessage,
    onYjsProtocol: handleYjsProtocol,
    onCollaborationHealth: handleCollaborationHealth,
    onLevelMetaUpdate: handleLevelMetaUpdate,
    onTransportMessage: handleTransportMessage,
  });

  // Make the current sender available synchronously so the first awareness
  // update is emitted once, without a follow-up "re-broadcast" effect.
  sendYjsProtocolRef.current = sendYjsProtocol;

  useEffect(() => {
    if (!isYjsEnabled) {
      return;
    }
    const awareness = yAwarenessRef.current;
    if (!awareness) {
      return;
    }
    if (!isConnected || !effectiveIdentity || !clientId) {
      queueLocalAwarenessState(null);
      return;
    }
    const existing = (getQueuedOrCurrentLocalAwarenessState() || {}) as {
      user?: { id?: string; name?: string; email?: string; image?: string };
      session?: { clientId?: string; role?: string };
    };
    const userChanged =
      existing.user?.id !== effectiveIdentity.id
      || existing.user?.name !== effectiveIdentity.name
      || existing.user?.email !== effectiveIdentity.email
      || existing.user?.image !== effectiveIdentity.image;
    const sessionChanged = existing.session?.clientId !== clientId || existing.session?.role !== sessionRole;
    if (!userChanged && !sessionChanged) {
      return;
    }
    queueLocalAwarenessState({
      ...existing,
      user: {
        id: effectiveIdentity.id,
        name: effectiveIdentity.name,
        email: effectiveIdentity.email,
        image: effectiveIdentity.image,
      },
      session: {
        clientId,
        role: sessionRole,
      },
    });
  }, [clientId, effectiveIdentity, getQueuedOrCurrentLocalAwarenessState, isConnected, isYjsEnabled, queueLocalAwarenessState, sessionRole]);

  /**
   * COLLABORATION STEP 16.6:
   * Send deduplicated health warnings to the server so recoverable glitches are
   * visible without flooding the backend with the same alert every second.
   */
  const reportCollaborationHealthEvent = useCallback((
    eventType: string,
    severity: CollaborationHealthSeverity,
    details: Record<string, unknown> = {},
    scope?: { editorType?: EditorType; levelIndex?: number }
  ) => {
    logCollaborationStep("16.6", "reportCollaborationHealthEvent", {
      eventType,
      severity,
      editorType: scope?.editorType ?? null,
      levelIndex: scope?.levelIndex ?? null,
    });
    const dedupeKey = `${eventType}:${scope?.levelIndex ?? "na"}:${scope?.editorType ?? "na"}`;
    const now = Date.now();
    const lastSentAt = lastHealthEventAtRef.current.get(dedupeKey) ?? 0;
    if (now - lastSentAt < STALL_RETRY_COOLDOWN_MS) {
      return;
    }
    lastHealthEventAtRef.current.set(dedupeKey, now);
    sendClientHealthEvent({
      eventType,
      severity,
      editorType: scope?.editorType,
      levelIndex: scope?.levelIndex,
      details,
    });
  }, [sendClientHealthEvent]);

  /**
   * COLLABORATION STEP 18.4:
   * Restart the Yjs handshake from the client side. In plain language, this says
   * "tell me what I am missing" without destroying local unsynced edits.
   */
  const sendYjsSyncStep1 = useCallback((reason: string) => {
    console.log(`[collab-loop] sendYjsSyncStep1 reason=${reason} room=${resolvedRoomId} connected=${isConnected}`);
    logCollaborationStep("18.4", "sendYjsSyncStep1", {
      reason,
      roomId: resolvedRoomId,
    });
    const doc = yDocRef.current;
    if (!resolvedRoomId || !isConnected || !doc) {
      return;
    }

    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, doc);
    const payloadBase64 = encodeUint8ArrayToBase64(encoding.toUint8Array(encoder));
    console.log("[yjs-sync:step1]", {
      roomId: resolvedRoomId,
      reason,
      serverGeneration: serverYjsDocGenerationRef.current,
      payloadLength: payloadBase64.length,
    });
    sendYjsProtocol({
      channel: "sync",
      payloadBase64,
      yjsDocGeneration: serverYjsDocGenerationRef.current,
    });
  }, [isConnected, resolvedRoomId, sendYjsProtocol]);

  /**
   * COLLABORATION STEP 16.7:
   * Decide whether an editor is active enough to justify a hash report, then send
   * that fingerprint so the server can compare clients without excessive chatter.
   */
  const maybeSendEditorHash = useCallback((state: LocalEditorWatchState, minIntervalMs: number) => {
    logCollaborationStep("16.7", "maybeSendEditorHash", {
      editorType: state.editorType,
      levelIndex: state.levelIndex,
      minIntervalMs,
    });
    const now = Date.now();
    if (!resolvedRoomId || !isConnected) {
      return;
    }
    if (now - state.lastHashSentAt < minIntervalMs) {
      return;
    }
    const recentlyActive =
      state.isFocused
      || now - state.lastLocalInputAt < STALL_DETECTION_WINDOW_MS
      || now - state.lastRemoteApplyAt < STALL_DETECTION_WINDOW_MS;
    if (!recentlyActive) {
      return;
    }
    sendClientStateHash({
      editorType: state.editorType,
      levelIndex: state.levelIndex,
      contentHash: state.contentHash,
      contentLength: state.contentLength,
      version: state.version ?? null,
      isFocused: state.isFocused,
      isEditable: state.isEditable,
      isTyping: state.isTyping,
      localInputAgeMs: state.lastLocalInputAt > 0 ? now - state.lastLocalInputAt : null,
      remoteApplyAgeMs: state.lastRemoteApplyAt > 0 ? now - state.lastRemoteApplyAt : null,
    });
    editorWatchStatesRef.current.set(getEditorWatchKey(state.editorType, state.levelIndex), {
      ...state,
      lastHashSentAt: now,
    });
  }, [isConnected, resolvedRoomId, sendClientStateHash]);

  /**
   * COLLABORATION STEP 16.8:
   * Record the latest local view of an editor's state: content hash, focus, typing,
   * and the last moments of local or remote activity. This powers stall detection
   * and divergence recovery without interfering with normal editing.
   */
  const reportEditorWatchState = useCallback((snapshot: EditorWatchdogSnapshot) => {
    logCollaborationStep("16.8", "reportEditorWatchState", {
      editorType: snapshot.editorType,
      levelIndex: snapshot.levelIndex,
      source: snapshot.source,
    });
    const now = snapshot.ts ?? Date.now();
    const key = getEditorWatchKey(snapshot.editorType, snapshot.levelIndex);
    const previous = editorWatchStatesRef.current.get(key);
    const nextState: LocalEditorWatchState = {
      ...snapshot,
      contentHash: hashContent(snapshot.content),
      contentLength: snapshot.content.length,
      lastObservedAt: now,
      lastHashSentAt: previous?.lastHashSentAt ?? 0,
      lastLocalInputAt: snapshot.source === "local_input" ? now : (previous?.lastLocalInputAt ?? 0),
      lastRemoteApplyAt:
        snapshot.source === "remote_apply" || snapshot.source === "room_sync"
          ? now
          : (previous?.lastRemoteApplyAt ?? 0),
      lastStallEventAt: previous?.lastStallEventAt ?? 0,
    };

    editorWatchStatesRef.current.set(key, nextState);
    if (snapshot.isFocused) {
      localActiveEditorRef.current = {
        editorType: snapshot.editorType,
        levelIndex: snapshot.levelIndex,
      };
    } else if (
      localActiveEditorRef.current?.editorType === snapshot.editorType
      && localActiveEditorRef.current?.levelIndex === snapshot.levelIndex
    ) {
      localActiveEditorRef.current = null;
    }

    maybeSendEditorHash(nextState, snapshot.source === "local_input" ? 600 : EDITOR_HASH_INTERVAL_MS);
  }, [maybeSendEditorHash]);

  useEffect(() => {
    if (!isYjsEnabled) {
      return;
    }

    // Start at generation 1 so early awareness/sync packets are not rejected by the server
    // (server generation is always >= 1 for Yjs-enabled rooms).
    replaceLocalYDoc("room_mount", 1);
    return () => {
      const doc = yDocRef.current;
      if (doc) {
        doc.destroy();
      }
      yDocRef.current = null;
      const awareness = yAwarenessRef.current;
      if (awareness) {
        awareness.destroy();
      }
      yAwarenessRef.current = null;
      serverYjsDocGenerationRef.current = 1;
    };
  }, [isYjsEnabled, replaceLocalYDoc, resolvedRoomId]);

  useEffect(() => {
    if (!resolvedRoomId || !isConnected || isLobbyRoomId) {
      return;
    }

    if (!initialRoomState) {
      const timer = setTimeout(() => {
        requestRoomStateSync("startup_missing_room_state");
      }, 1000);
      return () => clearTimeout(timer);
    }

    if (isYjsEnabled && !yjsReady) {
      const timer = setTimeout(() => {
        sendYjsSyncStep1("startup_missing_yjs_sync");
      }, 150);
      return () => clearTimeout(timer);
    }

    if (groupStartGate?.status === "started" && !hasSharedStartTime(initialRoomState)) {
      const timer = setTimeout(() => {
        requestRoomStateSync("startup_missing_shared_start");
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [groupStartGate?.status, initialRoomState, isConnected, isLobbyRoomId, isYjsEnabled, requestRoomStateSync, resolvedRoomId, sendYjsSyncStep1, yjsReady]);

  useEffect(() => {
    const wasConnected = wasConnectedRef.current;
    wasConnectedRef.current = isConnected;

    if (!resolvedRoomId || !isConnected || isLobbyRoomId) {
      return;
    }

    const isReconnect = hasConnectedOnceRef.current && !wasConnected;
    hasConnectedOnceRef.current = true;

    if (!isReconnect) {
      return;
    }

    const timer = setTimeout(() => {
      requestRoomStateSync("reconnect_recover");
      if (isYjsEnabled) {
        sendYjsSyncStep1("reconnect_recover");
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isConnected, isLobbyRoomId, isYjsEnabled, requestRoomStateSync, resolvedRoomId, sendYjsSyncStep1]);

  const { activeUsers, usersByTab, addUser, setUsers, removeUser, clearUsers } = useCollaborationPresence({});

  // Divergence recovery: when the server detects that client content hashes
  // differ, it sends a divergence_detected health message. We recover by
  // requesting a fresh room-state-sync and re-running the Yjs sync protocol
  // (SyncStep1 → server responds with SyncStep2 containing missing updates).
  //
  // IMPORTANT: We never call replaceLocalYDoc here. Replacing the Y.Doc
  // destroys all unsynced local edits and causes the editor to remount,
  // which users experience as "typed text getting erased". The CRDT sync
  // protocol is designed to merge divergent state non-destructively — a
  // SyncStep1 exchange is sufficient to reconcile any missing updates.
  useEffect(() => {
    if (!lastHealthMessage || !resolvedRoomId || !isConnected || isLobbyRoomId) {
      return;
    }

    if (lastHealthMessage.eventType !== "divergence_detected") {
      return;
    }

    const timer = window.setTimeout(() => {
      requestRoomStateSync(`health:${lastHealthMessage.eventType}`);
      if (isYjsEnabled) {
        const scopeKey = `${lastHealthMessage.levelIndex ?? "na"}:${lastHealthMessage.editorType ?? "na"}`;
        const recoveryState = divergenceRecoveryRef.current.get(scopeKey) || { retriedAt: 0 };
        const now = Date.now();
        if (recoveryState.retriedAt === 0 || now - recoveryState.retriedAt > DIVERGENCE_RECOVERY_WINDOW_MS) {
          divergenceRecoveryRef.current.set(scopeKey, { retriedAt: now });
          sendYjsSyncStep1(`health_resync:${scopeKey}`);
        }
      }
    }, 150);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isConnected, isLobbyRoomId, isYjsEnabled, lastHealthMessage, requestRoomStateSync, resolvedRoomId, sendYjsSyncStep1]);

  useEffect(() => {
    if (!resolvedRoomId || !isConnected || isLobbyRoomId) {
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      const latestTransportAt = lastTransportMessageAtRef.current;

      editorWatchStatesRef.current.forEach((state, key) => {
        maybeSendEditorHash(state, EDITOR_HASH_INTERVAL_MS);

        const remoteTypers = activeUsers.filter((user) =>
          user.isTyping
          && user.activeTab === state.editorType
          && user.activeLevelIndex === state.levelIndex
        ).length;
        const recentLocalTyping = now - state.lastLocalInputAt < STALL_DETECTION_WINDOW_MS;
        const transportStale = latestTransportAt > 0 && now - latestTransportAt > STALL_DETECTION_WINDOW_MS;
        const remoteApplyStale = state.lastRemoteApplyAt > 0 && now - state.lastRemoteApplyAt > STALL_DETECTION_WINDOW_MS;
        const focusedEditable = state.isFocused && state.isEditable;

        if (
          focusedEditable
          && recentLocalTyping
          && remoteTypers > 0
          && (transportStale || remoteApplyStale)
          && now - state.lastStallEventAt > STALL_RETRY_COOLDOWN_MS
        ) {
          editorWatchStatesRef.current.set(key, {
            ...state,
            lastStallEventAt: now,
          });
          reportCollaborationHealthEvent("editor_stalled", "error", {
            transportAgeMs: latestTransportAt > 0 ? now - latestTransportAt : null,
            remoteApplyAgeMs: state.lastRemoteApplyAt > 0 ? now - state.lastRemoteApplyAt : null,
            remoteTypers,
            contentHash: state.contentHash,
            contentLength: state.contentLength,
            version: state.version ?? null,
          }, {
            editorType: state.editorType,
            levelIndex: state.levelIndex,
          });
          requestRoomStateSync(`stall:${state.editorType}:${state.levelIndex}`);
          if (isYjsEnabled) {
            sendYjsSyncStep1(`stall:${state.editorType}:${state.levelIndex}`);
          }
        }
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    activeUsers,
    isConnected,
    isLobbyRoomId,
    isYjsEnabled,
    maybeSendEditorHash,
    reportCollaborationHealthEvent,
    requestRoomStateSync,
    resolvedRoomId,
    sendYjsSyncStep1,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined" || !resolvedRoomId || !isConnected) {
      return;
    }

    const observer = new PerformanceObserver((entryList) => {
      const activeEditor = localActiveEditorRef.current;
      for (const entry of entryList.getEntries()) {
        if (entry.duration < LONG_TASK_WARN_MS) {
          continue;
        }
        reportCollaborationHealthEvent("main_thread_blocked", "warn", {
          durationMs: Math.round(entry.duration),
          entryType: entry.entryType,
          name: entry.name,
        }, activeEditor ?? undefined);
      }
    });

    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  }, [isConnected, reportCollaborationHealthEvent, resolvedRoomId]);

  // Wire refs so handleUserJoined / handleCurrentUsers / handleUserLeftId can call them; flush any events that arrived early
  React.useLayoutEffect(() => {
    addUserRef.current = addUser;
    setUsersRef.current = setUsers;
    removeUserRef.current = removeUser;
    flushPendingPresence();
    // Delayed flush in case presence events were queued after this layout effect (e.g. fast current-users)
    const t = setTimeout(flushPendingPresence, 80);
    return () => clearTimeout(t);
  }, [addUser, setUsers, removeUser, flushPendingPresence]);

  const { updateLocalCursor } = useCollaborationCursor({
    sendCursor: sendCanvasCursor,
    onRemoteCursor: handleCanvasCursor,
  });

  useEffect(() => {
    return () => {
      clearUsers();
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
    };
  }, [clearUsers]);

  useEffect(() => {
    if (!resolvedRoomId || isConnected || !hasDisconnectedUnexpectedlyRef.current) {
      return;
    }

    clearUsers();
  }, [clearUsers, isConnected, resolvedRoomId]);

  useEffect(() => {
    queueMicrotask(() => {
      setLastProgressSync(null);
      setLastGameInstancesReset(null);
      setGroupStartGate(null);
      setLobbyMessages([]);
      setInitialRoomState(null);
      setLastHealthMessage(null);
      setCodeSyncReady(false);
      setYjsReady(false);
      yjsDocOutboundAllowedRef.current = false;
      setYjsDocGeneration(0);
      setCanvasCursors(new Map());
      setEditorCursors(new Map());
    });
    wasConnectedRef.current = false;
    hasConnectedOnceRef.current = false;
    lastTransportMessageAtRef.current = 0;
    editorWatchStatesRef.current.clear();
    localActiveEditorRef.current = null;
    lastHealthEventAtRef.current.clear();
    divergenceRecoveryRef.current.clear();
    serverYjsDocGenerationRef.current = 1;
  }, [resolvedRoomId]);

  const updateCanvasCursor = useCallback(
    (x: number, y: number) => {
      updateLocalCursor(x, y);
    },
    [updateLocalCursor]
  );

  /**
   * COLLABORATION STEP 5.7:
   * Merge the latest editor presence patch into the local awareness payload so
   * collaborators can see the active tab, level, selection, and typing state.
   */
  const updateAwarenessEditorState = useCallback((patch: {
    editorType?: EditorType;
    levelIndex?: number;
    selection?: { from: number; to: number } | null;
    isTyping?: boolean;
  }) => {
    logCollaborationStep("5.7", "updateAwarenessEditorState", {
      editorType: patch.editorType ?? null,
      levelIndex: patch.levelIndex ?? null,
      isTyping: patch.isTyping ?? null,
      hasSelection: Boolean(patch.selection),
    });
    const awareness = yAwarenessRef.current;
    if (!awareness) {
      return;
    }
    const current = (getQueuedOrCurrentLocalAwarenessState() || {}) as {
      editor?: {
        editorType?: EditorType;
        levelIndex?: number;
        selection?: { from: number; to: number } | null;
        isTyping?: boolean;
      };
    };
    const currentEditor =
      current.editor && typeof current.editor === "object" && !Array.isArray(current.editor)
        ? current.editor
        : {};
    const nextEditor = {
      ...currentEditor,
      ...(patch.editorType ? { editorType: patch.editorType } : {}),
      ...(Number.isInteger(patch.levelIndex) ? { levelIndex: patch.levelIndex } : {}),
      ...(typeof patch.isTyping === "boolean" ? { isTyping: patch.isTyping } : {}),
      ...(patch.selection ? { selection: patch.selection } : {}),
    };
    const changed =
      currentEditor.editorType !== nextEditor.editorType
      || currentEditor.levelIndex !== nextEditor.levelIndex
      || currentEditor.isTyping !== nextEditor.isTyping
      || !sameSelection(
        currentEditor.selection as { from: number; to: number } | null | undefined,
        nextEditor.selection as { from: number; to: number } | null | undefined
      );
    if (!changed) {
      return;
    }
    queueLocalAwarenessState({
      ...current,
      editor: nextEditor,
    });
  }, [getQueuedOrCurrentLocalAwarenessState, queueLocalAwarenessState]);

  /**
   * COLLABORATION STEP 5.8:
   * Publish the current local selection into awareness so remote carets can be
   * drawn in the right place for this editor and level.
   */
  const updateEditorSelection = useCallback(
    (editorType: EditorType, levelIndex: number, selection: { from: number; to: number }) => {
      logCollaborationStep("5.8", "updateEditorSelection", {
        editorType,
        levelIndex,
        from: selection.from,
        to: selection.to,
      });
      updateAwarenessEditorState({ editorType, levelIndex, selection });
    },
    [updateAwarenessEditorState]
  );

  /**
   * COLLABORATION STEP 5.9:
   * Tell collaborators which editor tab and level this user is currently focused
   * on, and reset typing state during that focus change.
   */
  const setActiveTab = useCallback(
    (editorType: EditorType, levelIndex: number) => {
      logCollaborationStep("5.9", "setActiveTab", {
        editorType,
        levelIndex,
      });
      localActiveEditorRef.current = { editorType, levelIndex };
      updateAwarenessEditorState({ editorType, levelIndex, isTyping: false });
    },
    [updateAwarenessEditorState]
  );

  /**
   * COLLABORATION STEP 5.10:
   * Toggle the typing bit inside awareness so other users can see live activity
   * in the active editor.
   */
  const setTyping = useCallback(
    (editorType: EditorType, levelIndex: number, isTyping: boolean) => {
      logCollaborationStep("5.10", "setTyping", {
        editorType,
        levelIndex,
        isTyping,
      });
      updateAwarenessEditorState({ editorType, levelIndex, isTyping });
    },
    [updateAwarenessEditorState]
  );

  /**
   * COLLABORATION STEP 18.5:
   * Ask the server to reset either one level or the whole game back to a clean
   * baseline when collaboration needs a hard content reset.
   */
  const resetRoomState = useCallback((scope: "level" | "game", levelIndex?: number) => {
    logCollaborationStep("18.5", "resetRoomState", {
      scope,
      levelIndex: levelIndex ?? null,
    });
    sendRoomReset(scope, levelIndex);
  }, [sendRoomReset]);

  /**
   * COLLABORATION STEP 18.6:
   * Send non-code progress metadata through the collaboration channel so all
   * clients stay aligned on room progress alongside the shared code.
   */
  const syncProgressData = useCallback((progressData: Record<string, unknown>) => {
    logCollaborationStep("18.6", "syncProgressData", {
      keys: Object.keys(progressData),
    });
    sendProgressSync(progressData);
  }, [sendProgressSync]);

  /**
   * COLLABORATION STEP 18.7:
   * Toggle this participant's ready state for synchronized group start behavior.
   */
  const setGroupReady = useCallback((isReady: boolean) => {
    logCollaborationStep("18.7", "setGroupReady", {
      isReady,
    });
    if (isReady) {
      sendGroupStartReady();
      return;
    }
    sendGroupStartUnready();
  }, [sendGroupStartReady, sendGroupStartUnready]);

  /**
   * COLLABORATION STEP 4.3:
   * This is left in place for compatibility with the older patch-based editor API.
   * In the current Yjs flow it is intentionally a no-op because code changes move
   * through shared Y.Text bindings instead of bespoke patch messages.
   */
  const applyEditorChangeWrapper = useCallback(
    (
      _editorType: EditorType,
      _changeSetJson: unknown,
      _levelIndex: number,
      _baseVersion: number,
      _selection?: { from: number; to: number }
    ) => {
      logCollaborationStep("4.3", "applyEditorChangeWrapper", {
        editorType: _editorType,
        levelIndex: _levelIndex,
        baseVersion: _baseVersion,
        hasSelection: Boolean(_selection),
      });
      // Yjs is the only document sync path; local changes flow through Y.Text bindings.
    },
    []
  );

  const resolvedCodeSyncReady = isYjsEnabled ? Boolean(initialRoomState) && yjsReady : true;

  const value = useMemo<CollaborationContextValue>(
    () => ({
      collabEngine,
      isYjsEnabled,
      isConnected,
      isConnecting,
      error,
      isSessionEvicted,
      reclaimSession,
      connectReadOnly,
      sessionRole,
      roomId: resolvedRoomId,
      groupId: resolvedGroupId,
      clientId,
      effectiveIdentity,
      activeUsers,
      usersByTab,
      remoteCursors: canvasCursors,
      editorCursors,
      remoteCodeChanges,
      remoteCodeResyncs,
      localCodeAcks,
      lastProgressSync,
      lastGameInstancesReset,
      groupStartGate,
      lobbyMessages,
      initialRoomState,
      lastHealthMessage,
      lastLevelMetaUpdate,
      codeSyncReady: resolvedCodeSyncReady,
      yjsReady,
      yjsDocGeneration,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChange: applyEditorChangeWrapper,
      getEditorVersion,
      setActiveTab,
      setTyping,
      resetRoomState,
      syncProgressData,
      setGroupReady,
      sendLobbyChat,
      sendLevelMetaUpdate,
      reportEditorWatchState,
      reportCollaborationHealthEvent,
      getYText,
      getYCodeSnapshot,
      getYSolutionText,
      getYSolutionSnapshot,
      connect,
      disconnect,
    }),
    [
      collabEngine,
      isYjsEnabled,
      isConnected,
      isConnecting,
      error,
      isSessionEvicted,
      sessionRole,
      reclaimSession,
      connectReadOnly,
      resolvedRoomId,
      resolvedGroupId,
      clientId,
      effectiveIdentity,
      activeUsers,
      usersByTab,
      canvasCursors,
      editorCursors,
      remoteCodeChanges,
      remoteCodeResyncs,
      localCodeAcks,
      lastProgressSync,
      lastGameInstancesReset,
      groupStartGate,
      lobbyMessages,
      initialRoomState,
      lastHealthMessage,
      resolvedCodeSyncReady,
      yjsReady,
      yjsDocGeneration,
      updateCanvasCursor,
      updateEditorSelection,
      applyEditorChangeWrapper,
      getEditorVersion,
      setActiveTab,
      setTyping,
      resetRoomState,
      syncProgressData,
      setGroupReady,
      sendLobbyChat,
      sendLevelMetaUpdate,
      lastLevelMetaUpdate,
      reportEditorWatchState,
      reportCollaborationHealthEvent,
      getYText,
      getYCodeSnapshot,
      getYSolutionText,
      getYSolutionSnapshot,
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

export function useOptionalCollaboration(): CollaborationContextValue | null {
  return useContext(CollaborationContext);
}

/**
 * COLLABORATION STEP 14.3:
 * Read a plain React-friendly snapshot of one level's shared HTML/CSS/JS from the
 * live Yjs document. This is useful for parts of the UI that need current code
 * without mounting a full collaborative editor.
 */
export function useYjsLevelCodeSnapshot(
  levelIndex: number,
  fallbackCode: { html: string; css: string; js: string },
) {
  logCollaborationStep("14.3", "useYjsLevelCodeSnapshot", {
    levelIndex,
  });
  const collaboration = useOptionalCollaboration();
  const getYText = collaboration?.getYText;
  const yjsDocGeneration = collaboration?.yjsDocGeneration ?? 0;
  const [code, setCode] = useState(fallbackCode);

  useEffect(() => {
    if (!getYText || levelIndex < 0) {
      setCode(fallbackCode);
      return;
    }

    const editorTypes: EditorType[] = ["html", "css", "js"];
    /**
     * COLLABORATION STEP 14.4:
     * Pull the latest shared code for all three editors in this level into local
     * component state so non-editor consumers stay in sync with the CRDT document.
     */
    const sync = () => {
      console.log(`[collab-loop] useYjsLevelCodeSnapshot.sync levelIndex=${levelIndex}`);
      logCollaborationStep("14.4", "useYjsLevelCodeSnapshot.sync", {
        levelIndex,
      });
      const nextHtml = getYText("html", levelIndex)?.toString() ?? fallbackCode.html;
      const nextCss = getYText("css", levelIndex)?.toString() ?? fallbackCode.css;
      const nextJs = getYText("js", levelIndex)?.toString() ?? fallbackCode.js;
      setCode((prev) => {
        if (prev.html === nextHtml && prev.css === nextCss && prev.js === nextJs) {
          return prev;
        }
        return { html: nextHtml, css: nextCss, js: nextJs };
      });
    };

    sync();
    const texts = editorTypes.map((editorType) => getYText(editorType, levelIndex)).filter((text): text is Y.Text => Boolean(text));
    const observer = () => {
      sync();
    };
    texts.forEach((text) => text.observe(observer));
    return () => {
      texts.forEach((text) => text.unobserve(observer));
    };
  }, [
    fallbackCode.css,
    fallbackCode.html,
    fallbackCode.js,
    getYText,
    levelIndex,
    yjsDocGeneration,
  ]);

  return code;
}
