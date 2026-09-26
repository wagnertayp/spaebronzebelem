CREATE TABLE "spa_operational_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
