export interface CanvasCursor {
  groupId: string;
  clientId: string;
  userId: string;
  userName?: string;
  userImage?: string;
  color: string;
  x: number;
  y: number;
  ts: number;
}

export interface EditorCursor {
  groupId: string;
  editorType: "html" | "css" | "js";
  clientId: string;
  userId: string;
  userName?: string;
  color: string;
  selection: { from: number; to: number };
  ts: number;
}

export interface EditorChange {
  groupId: string;
  editorType: "html" | "css" | "js";
  clientId: string;
  userId: string;
  version: number;
  changes: unknown[];
  isAck?: boolean;
  serverTs?: string;
}

export interface ActiveUser {
  clientId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userImage?: string;
  color?: string;
  cursor?: { x: number; y: number };
}

export interface CollaborationState {
  isConnected: boolean;
  isConnecting: boolean;
  activeUsers: ActiveUser[];
  remoteCursors: Map<string, CanvasCursor>;
  editorCursors: Map<string, EditorCursor>;
  groupId: string | null;
  error: string | null;
  clientId: string | null;
}

export interface JoinGamePayload {
  groupId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  userImage?: string;
}

export interface LeaveGamePayload {
  groupId: string;
}

export type EditorType = "html" | "css" | "js";

export interface UserIdentity {
  id: string;
  email: string;
  name?: string;
  image?: string;
}
