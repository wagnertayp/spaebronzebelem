CREATE TABLE "evolution_instance_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"instance_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
