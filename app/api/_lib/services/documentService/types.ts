export type PermissionLevel = "owner" | "editor" | "viewer";

export interface DocumentShare {
  id: string;
  documentId: string;
  ownerUserId: string;
  sharedUserId?: string; // Optional for guest access
  permission: PermissionLevel;
  allowGuestAccess: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChange {
  id: string;
  documentId: string;
  sessionId: string;
  userId: string;
  version: number;
  operation: unknown;
  createdAt: Date;
}

export interface DocumentSession {
  id: string;
  documentId: string;
  userId: string;
  userName?: string;
  lastActiveAt: Date;
  cursorPosition?: unknown;
  createdAt: Date;
  updatedAt: Date;
}
