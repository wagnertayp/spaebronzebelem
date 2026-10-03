CREATE TABLE "whatsapp_webhook_inbox" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"lease_token" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_webhook_inbox_event_key_unique" ON "whatsapp_webhook_inbox" USING btree ("event_key");--> statement-breakpoint
CREATE INDEX "whatsapp_webhook_inbox_pending_idx" ON "whatsapp_webhook_inbox" USING btree ("status","available_at","created_at");