import { pgTable, uuid, text, integer, boolean, jsonb, timestamp, index, primaryKey } from "drizzle-orm/pg-core";

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
    easyLevelPoints: integer("easy_level_points").notNull(),
    mediumLevelPoints: integer("medium_level_points").notNull(),
    hardLevelPoints: integer("hard_level_points").notNull(),
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
    progressData: jsonb("progress_data").notNull().default({}),
    isPublic: boolean("is_public").default(false).notNull(),
    shareToken: text("share_token").unique(),
    thumbnailUrl: text("thumbnail_url"),
    hideSidebar: boolean("hide_sidebar").default(false).notNull(),
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
  ]
);
