CREATE TABLE "lti_nonces" (
	"consumer_key" text NOT NULL,
	"nonce" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "lti_nonces_consumer_key_nonce_pk" PRIMARY KEY("consumer_key","nonce")
);
--> statement-breakpoint
CREATE INDEX "idx_lti_nonces_expires_at" ON "lti_nonces" USING btree ("expires_at");