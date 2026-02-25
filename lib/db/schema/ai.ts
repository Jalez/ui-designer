import { pgTable, uuid, varchar, text, boolean, integer, decimal, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

export const aiProviders = pgTable(
  "ai_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    privacyPolicyUrl: text("privacy_policy_url"),
    termsOfServiceUrl: text("terms_of_service_url"),
    statusPageUrl: text("status_page_url"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ai_providers_slug").on(table.slug),
    index("idx_ai_providers_active").on(table.isActive),
  ]
);

export const aiModels = pgTable(
  "ai_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    modelId: varchar("model_id", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 500 }).notNull(),
    providerSlug: varchar("provider_slug", { length: 255 }).references(() => aiProviders.slug),
    description: text("description"),
    contextLength: integer("context_length"),
    modalities: text("modalities").array().notNull(),
    promptPrice: decimal("prompt_price", { precision: 12, scale: 8 }),
    completionPrice: decimal("completion_price", { precision: 12, scale: 8 }),
    imagePrice: decimal("image_price", { precision: 10, scale: 4 }),
    requestPrice: decimal("request_price", { precision: 10, scale: 4 }),
    supportsToolUse: boolean("supports_tool_use").default(false).notNull(),
    supportsPromptCaching: boolean("supports_prompt_caching").default(false).notNull(),
    supportsResponseSchema: boolean("supports_response_schema").default(false).notNull(),
    architecture: jsonb("architecture"),
    topProvider: jsonb("top_provider"),
    perRequestLimits: jsonb("per_request_limits"),
    apiProvider: varchar("api_provider", { length: 50 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_ai_models_model_id").on(table.modelId),
    index("idx_ai_models_provider_slug").on(table.providerSlug),
    index("idx_ai_models_active").on(table.isActive),
    index("idx_ai_models_prompt_price").on(table.promptPrice),
    index("idx_ai_models_image_price").on(table.imagePrice),
  ]
);

export const modelUsageAnalytics = pgTable(
  "model_usage_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    modelId: varchar("model_id", { length: 255 }).notNull(),
    usageType: varchar("usage_type", { length: 50 }).notNull(),
    tokensUsed: integer("tokens_used"),
    imagesGenerated: integer("images_generated"),
    actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_model_usage_user_id").on(table.userId),
    index("idx_model_usage_model_id").on(table.modelId),
    index("idx_model_usage_created_at").on(table.createdAt),
    index("idx_model_usage_type").on(table.usageType),
  ]
);

export const userDefaultModels = pgTable(
  "user_default_models",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    textModel: varchar("text_model", { length: 255 }),
    imageModel: varchar("image_model", { length: 255 }),
    imageOcrModel: varchar("image_ocr_model", { length: 255 }),
    pdfOcrModel: varchar("pdf_ocr_model", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_user_default_models_user_id").on(table.userId)]
);
