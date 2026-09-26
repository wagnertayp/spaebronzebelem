import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

export const spaOperationalStateTable = pgTable("spa_operational_state", {
  id: integer("id").primaryKey(),
  version: integer("version").notNull(),
  payload: jsonb("payload").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});