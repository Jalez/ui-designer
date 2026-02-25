import { pgTable, uuid, varchar, text, boolean, integer, bigint, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const documents = pgTable(
  "documents",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content"),
    contentHtml: text("content_html"),
    contentJson: text("content_json"),
    hasBeenEntered: boolean("has_been_entered").default(false).notNull(),
    isTemporary: boolean("is_temporary").default(false).notNull(),
    anonymousSessionId: varchar("anonymous_session_id", { length: 255 }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_documents_user_id").on(table.userId),
    index("idx_documents_updated_at").on(table.updatedAt),
    index("idx_documents_temporary_expires").on(table.isTemporary, table.expiresAt),
    index("idx_documents_anonymous_session").on(table.anonymousSessionId),
  ]
);

export const sourceFiles = pgTable(
  "source_files",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    documentId: varchar("document_id", { length: 36 }).references(() => documents.id, { onDelete: "cascade" }),
    fileType: varchar("file_type", { length: 20, enum: ["image", "pdf", "document"] }).notNull(),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    filePath: text("file_path"),
    driveFileId: varchar("drive_file_id", { length: 100 }),
    sections: text("sections").array(),
    highlightColor: varchar("highlight_color", { length: 7 }),
    webViewLink: text("web_view_link"),
    webContentLink: text("web_content_link"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_source_files_document_id").on(table.documentId)]
);

export const documentShares = pgTable(
  "document_shares",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    documentId: varchar("document_id", { length: 36 }).references(() => documents.id, { onDelete: "cascade" }),
    ownerUserId: uuid("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sharedUserId: uuid("shared_user_id").references(() => users.id, { onDelete: "cascade" }),
    permission: varchar("permission", { length: 10, enum: ["owner", "editor", "viewer"] }).notNull().default("viewer"),
    allowGuestAccess: boolean("allow_guest_access").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_document_shares_document_id").on(table.documentId),
    index("idx_document_shares_shared_user_id").on(table.sharedUserId),
  ]
);

export const documentSessions = pgTable(
  "document_sessions",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    documentId: varchar("document_id", { length: 36 }).references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    userName: varchar("user_name", { length: 255 }),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).defaultNow().notNull(),
    cursorPosition: jsonb("cursor_position"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_document_sessions_document_id").on(table.documentId),
    index("idx_document_sessions_last_active").on(table.lastActiveAt),
  ]
);

export const documentChanges = pgTable(
  "document_changes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    documentId: varchar("document_id", { length: 36 }).references(() => documents.id, { onDelete: "cascade" }),
    sessionId: varchar("session_id", { length: 36 }).references(() => documentSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    version: bigint("version", { mode: "bigint" }).notNull(),
    operation: jsonb("operation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_document_changes_document_id").on(table.documentId),
    index("idx_document_changes_version").on(table.documentId, table.version),
  ]
);
