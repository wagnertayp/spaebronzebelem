import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffAccessAccountsTable = pgTable("staff_access_accounts", {
  id: serial("id").primaryKey(),
  professionalId: integer("professional_id").notNull().unique(),
  username: text("username").notNull().unique(),
  passwordSalt: text("password_salt").notNull(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  canAccessAgenda: boolean("can_access_agenda").notNull().default(true),
  canAccessCommissions: boolean("can_access_commissions").notNull().default(true),
  agendaScope: text("agenda_scope").$type<"own" | "team">().notNull().default("team"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  sessionVersion: integer("session_version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertStaffAccessAccountSchema = createInsertSchema(staffAccessAccountsTable).omit({
  id: true,
  sessionVersion: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStaffAccessAccount = z.infer<typeof insertStaffAccessAccountSchema>;
export type StaffAccessAccountRecord = typeof staffAccessAccountsTable.$inferSelect;