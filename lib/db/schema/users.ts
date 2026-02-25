import { pgTable, uuid, varchar, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    image: text("image"),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    stripeCustomerId: varchar("stripe_customer_id", { length: 100 }).unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_users_email").on(table.email),
    index("idx_users_stripe_customer_id").on(table.stripeCustomerId),
    index("idx_users_created_at").on(table.createdAt),
  ]
);

export const adminRoles = pgTable(
  "admin_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
    role: varchar("role", { length: 20, enum: ["admin", "super_admin", "moderator"] }).notNull().default("admin"),
    grantedBy: uuid("granted_by").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_admin_roles_user_id").on(table.userId),
    index("idx_admin_roles_active").on(table.isActive),
    index("idx_admin_roles_role").on(table.role),
  ]
);
