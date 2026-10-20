import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const coordinationLeasesTable = pgTable("app_coordination_leases", {
  lockKey: text("lock_key").primaryKey(),
  ownerToken: text("owner_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
