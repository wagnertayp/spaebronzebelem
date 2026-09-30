CREATE TABLE IF NOT EXISTS "staff_access_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"professional_id" integer NOT NULL,
	"username" text NOT NULL,
	"password_salt" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"can_access_agenda" boolean DEFAULT true NOT NULL,
	"can_access_commissions" boolean DEFAULT true NOT NULL,
	"agenda_scope" text DEFAULT 'team' NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_access_accounts_professional_id_unique" UNIQUE("professional_id"),
	CONSTRAINT "staff_access_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "staff_access_accounts"
ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 1 NOT NULL;
