import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { groups } from "./groups";

export const levels = pgTable(
  "levels",
  {
    identifier: uuid("identifier").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    json: jsonb("json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_levels_name").on(table.name)]
);

export const maps = pgTable(
  "maps",
  {
    name: text("name").primaryKey(),
    random: integer("random").notNull().default(0),
    canUseAi: boolean("can_use_ai").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }
);

export const mapLevels = pgTable(
  "map_levels",
  {
    mapName: text("map_name").notNull().references(() => maps.name, { onDelete: "cascade" }),
    levelIdentifier: uuid("level_identifier").notNull().references(() => levels.identifier, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.mapName, table.levelIdentifier] }),
    index("idx_map_levels_map_name").on(table.mapName),
    index("idx_map_levels_level_identifier").on(table.levelIdentifier),
  ]
);

export const userSessions = pgTable(
  "user_sessions",
  {
    sessionId: uuid("session_id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    value: text("value"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_user_sessions_key").on(table.key),
    index("idx_user_sessions_expires_at").on(table.expiresAt),
  ]
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    mapName: text("map_name").notNull().references(() => maps.name, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    progressData: jsonb("progress_data").notNull().default({}),
    isPublic: boolean("is_public").default(false).notNull(),
    shareToken: text("share_token").unique(),
    thumbnailUrl: text("thumbnail_url"),
    hideSidebar: boolean("hide_sidebar").default(false).notNull(),
    accessWindowEnabled: boolean("access_window_enabled").default(false).notNull(),
    accessStartsAt: timestamp("access_starts_at", { withTimezone: true }),
    accessEndsAt: timestamp("access_ends_at", { withTimezone: true }),
    accessWindowTimezone: text("access_window_timezone"),
    accessWindows: jsonb("access_windows").notNull().default([]),
    accessKeyRequired: boolean("access_key_required").default(false).notNull(),
    accessKey: text("access_key"),
    collaborationMode: text("collaboration_mode").default("individual").notNull(),
    allowDuplicateUsers: boolean("allow_duplicate_users").default(true).notNull(),
    drawboardCaptureMode: text("drawboard_capture_mode").notNull().default("browser"),
    manualDrawboardCapture: boolean("manual_drawboard_capture").notNull().default(false),
    remoteSyncDebounceMs: integer("remote_sync_debounce_ms").notNull().default(500),
    drawboardReloadDebounceMs: integer("drawboard_reload_debounce_ms").notNull().default(48),
    instanceRetentionHours: integer("instance_retention_hours"),
    instanceRetentionAnchorAt: timestamp("instance_retention_anchor_at", { withTimezone: true }),
    instancePurgeCadence: text("instance_purge_cadence"),
    instancePurgeTimezone: text("instance_purge_timezone"),
    instancePurgeHour: integer("instance_purge_hour"),
    instancePurgeMinute: integer("instance_purge_minute"),
    instancePurgeWeekday: integer("instance_purge_weekday"),
    instancePurgeDayOfMonth: integer("instance_purge_day_of_month"),
    instancePurgeLastExecutedAt: timestamp("instance_purge_last_executed_at", { withTimezone: true }),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_projects_user_id").on(table.userId),
    index("idx_projects_map_name").on(table.mapName),
    index("idx_projects_user_map").on(table.userId, table.mapName),
    index("idx_projects_updated_at").on(table.updatedAt),
    index("idx_projects_is_public").on(table.isPublic),
    index("idx_projects_share_token").on(table.shareToken),
    index("idx_projects_access_window_enabled").on(table.accessWindowEnabled),
    index("idx_projects_group_id").on(table.groupId),
  ]
);

export const projectCollaborators = pgTable(
  "project_collaborators",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    addedBy: text("added_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.userId] }),
    index("idx_project_collaborators_project_id").on(table.projectId),
    index("idx_project_collaborators_user_id").on(table.userId),
  ],
);

export const gameInstances = pgTable(
  "game_instances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    scope: text("scope").notNull(),
    userId: text("user_id"),
    groupId: uuid("group_id"),
    progressData: jsonb("progress_data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_game_instances_game_id").on(table.gameId),
    index("idx_game_instances_group_id").on(table.groupId),
    index("idx_game_instances_user_id").on(table.userId),
    index("idx_game_instances_scope").on(table.scope),
    index("idx_game_instances_updated_at").on(table.updatedAt),
  ],
);

export const gameAttempts = pgTable(
  "game_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    instanceId: uuid("instance_id").references(() => gameInstances.id, { onDelete: "set null" }),
    userId: uuid("user_id"),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    scope: text("scope").notNull(),
    playerDisplayName: text("player_display_name"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms"),
    finalPoints: integer("final_points").notNull().default(0),
    maxPoints: integer("max_points").notNull().default(0),
    accuracyPercent: integer("accuracy_percent").notNull().default(0),
    attemptNumber: integer("attempt_number").notNull().default(1),
    isFinished: boolean("is_finished").notNull().default(true),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_game_attempts_game_id").on(table.gameId),
    index("idx_game_attempts_finished_at").on(table.finishedAt),
    index("idx_game_attempts_game_score_time").on(table.gameId, table.finalPoints, table.durationMs),
    index("idx_game_attempts_user_id").on(table.userId),
    index("idx_game_attempts_group_id").on(table.groupId),
    index("idx_game_attempts_instance_id").on(table.instanceId),
  ],
);

export const gameAttemptLevels = pgTable(
  "game_attempt_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id").notNull().references(() => gameAttempts.id, { onDelete: "cascade" }),
    levelIndex: integer("level_index").notNull(),
    levelName: text("level_name").notNull(),
    points: integer("points").notNull().default(0),
    maxPoints: integer("max_points").notNull().default(0),
    accuracyPercent: integer("accuracy_percent").notNull().default(0),
    bestTimeMs: integer("best_time_ms"),
    rawBestTime: text("raw_best_time"),
    difficulty: text("difficulty"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_game_attempt_levels_attempt_id").on(table.attemptId),
    index("idx_game_attempt_levels_level_index").on(table.levelIndex),
  ],
);

export const gameAttemptParticipants = pgTable(
  "game_attempt_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id").notNull().references(() => gameAttempts.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    displayName: text("display_name"),
    contributionScore: integer("contribution_score").notNull().default(0),
    pasteCount: integer("paste_count").notNull().default(0),
    largePasteCount: integer("large_paste_count").notNull().default(0),
    focusLossCount: integer("focus_loss_count").notNull().default(0),
    activeEditMs: integer("active_edit_ms").notNull().default(0),
    editCount: integer("edit_count").notNull().default(0),
    resetLevelCount: integer("reset_level_count").notNull().default(0),
    resetGameCount: integer("reset_game_count").notNull().default(0),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_game_attempt_participants_attempt_id").on(table.attemptId),
    index("idx_game_attempt_participants_user_id").on(table.userId),
  ],
);

export const drawboardArtifactCache = pgTable(
  "drawboard_artifact_cache",
  {
    key: text("key").primaryKey(),
    gameId: text("game_id"),
    data: jsonb("data").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("idx_drawboard_artifact_cache_game_id").on(table.gameId),
    index("idx_drawboard_artifact_cache_expires_at").on(table.expiresAt),
  ],
);

export const gameAttemptEvents = pgTable(
  "game_attempt_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id").notNull().references(() => gameAttempts.id, { onDelete: "cascade" }),
    userId: uuid("user_id"),
    levelIndex: integer("level_index"),
    eventType: text("event_type").notNull(),
    eventValue: jsonb("event_value").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_game_attempt_events_attempt_id").on(table.attemptId),
    index("idx_game_attempt_events_user_id").on(table.userId),
    index("idx_game_attempt_events_level_index").on(table.levelIndex),
  ],
);
