CREATE TABLE "whatsapp_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"client_name" text NOT NULL,
	"status" text DEFAULT 'agent' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whatsapp_conversations_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"direction" text NOT NULL,
	"phone" text NOT NULL,
	"client_name" text NOT NULL,
	"appointment_id" integer,
	"text" text NOT NULL,
	"status" text NOT NULL,
	"kind" text NOT NULL,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"ai_agent_config" jsonb NOT NULL,
	"whatsapp_automation" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_followups" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"trigger_message_id" integer NOT NULL,
	"sent_message_id" integer,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"claimed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_followups" ADD CONSTRAINT "whatsapp_followups_conversation_id_whatsapp_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."whatsapp_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_followups" ADD CONSTRAINT "whatsapp_followups_trigger_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("trigger_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_followups" ADD CONSTRAINT "whatsapp_followups_sent_message_id_whatsapp_messages_id_fk" FOREIGN KEY ("sent_message_id") REFERENCES "public"."whatsapp_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_followups_trigger_message_uidx" ON "whatsapp_followups" USING btree ("trigger_message_id");--> statement-breakpoint
CREATE INDEX "whatsapp_followups_due_status_idx" ON "whatsapp_followups" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "whatsapp_followups_conversation_status_idx" ON "whatsapp_followups" USING btree ("conversation_id","status");