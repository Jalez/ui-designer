import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

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
  ]
);
