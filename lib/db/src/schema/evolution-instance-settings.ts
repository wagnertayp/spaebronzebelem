import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const evolutionInstanceSettingsTable = pgTable("evolution_instance_settings", {
  id: integer("id").primaryKey(),
  instanceName: text("instance_name"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEvolutionInstanceSettingsSchema = createInsertSchema(evolutionInstanceSettingsTable).omit({
  updatedAt: true,
});
export type InsertEvolutionInstanceSettings = z.infer<typeof insertEvolutionInstanceSettingsSchema>;
export type EvolutionInstanceSettings = typeof evolutionInstanceSettingsTable.$inferSelect;