CREATE TABLE "app_coordination_leases" (
	"lock_key" text PRIMARY KEY NOT NULL,
	"owner_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
