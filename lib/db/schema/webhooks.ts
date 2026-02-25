import { pgTable, varchar, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const webhookIdempotency = pgTable(
  "webhook_idempotency",
  {
    id: varchar("id", { length: 100 }).primaryKey(),
    eventId: varchar("event_id", { length: 100 }).notNull().unique(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 15, enum: ["processing", "completed", "failed"] }).notNull(),
    retryCount: integer("retry_count").default(0).notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_webhook_idempotency_status").on(table.status),
    index("idx_webhook_idempotency_event_id").on(table.eventId),
    index("idx_webhook_idempotency_created_at").on(table.createdAt),
  ]
);
