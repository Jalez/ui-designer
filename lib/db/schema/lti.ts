import { pgTable, uuid, text, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Per-user LTI 1.0 consumer key/secret pairs (see `app/api/lti/*`). */
export const ltiCredentials = pgTable(
  "lti_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    consumerKey: text("consumer_key").notNull().unique(),
    consumerSecret: text("consumer_secret").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_lti_credentials_consumer_key").on(table.consumerKey),
    index("idx_lti_credentials_user_id").on(table.userId),
  ],
);

/** Seen LTI launch nonces, used to reject OAuth 1.0 replays (see `lib/lti/nonce.ts`). */
export const ltiNonces = pgTable(
  "lti_nonces",
  {
    consumerKey: text("consumer_key").notNull(),
    nonce: text("nonce").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.consumerKey, table.nonce] }),
    index("idx_lti_nonces_expires_at").on(table.expiresAt),
  ],
);
