CREATE TABLE "drawboard_artifact_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"game_id" text,
	"data" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_drawboard_artifact_cache_game_id" ON "drawboard_artifact_cache" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_drawboard_artifact_cache_expires_at" ON "drawboard_artifact_cache" USING btree ("expires_at");