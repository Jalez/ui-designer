import { pgTable, uuid, integer, varchar, decimal, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const userCredits = pgTable(
  "user_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
    currentCredits: integer("current_credits").notNull().default(0),
    totalCreditsEarned: integer("total_credits_earned").notNull().default(0),
    totalCreditsUsed: integer("total_credits_used").notNull().default(0),
    lastResetDate: timestamp("last_reset_date", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_user_credits_user_id").on(table.userId)]
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    transactionType: varchar("transaction_type", { length: 20, enum: ["usage", "subscription", "reset", "bonus", "refund"] }).notNull(),
    serviceName: varchar("service_name", { length: 100 }),
    serviceCategory: varchar("service_category", { length: 50 }),
    creditsUsed: integer("credits_used").notNull(),
    creditsBefore: integer("credits_before").notNull(),
    creditsAfter: integer("credits_after").notNull(),
    actualPrice: decimal("actual_price", { precision: 10, scale: 4 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_credit_transactions_user_id").on(table.userId),
    index("idx_credit_transactions_created_at").on(table.createdAt),
    index("idx_credit_transactions_service_name").on(table.serviceName),
    index("idx_credit_transactions_service_category").on(table.serviceCategory),
    index("idx_credit_transactions_actual_price").on(table.actualPrice),
  ]
);
