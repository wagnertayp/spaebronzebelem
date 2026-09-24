import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { whatsappConversationsTable, whatsappMessagesTable } from "./whatsapp-conversations";

export const whatsappFollowupsTable = pgTable("whatsapp_followups", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => whatsappConversationsTable.id, { onDelete: "cascade" }),
  triggerMessageId: integer("trigger_message_id")
    .notNull()
    .references(() => whatsappMessagesTable.id, { onDelete: "cascade" }),
  sentMessageId: integer("sent_message_id")
    .references(() => whatsappMessagesTable.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  triggerMessageUnique: uniqueIndex("whatsapp_followups_trigger_message_uidx").on(table.triggerMessageId),
  dueStatusIndex: index("whatsapp_followups_due_status_idx").on(table.status, table.dueAt),
  conversationStatusIndex: index("whatsapp_followups_conversation_status_idx").on(table.conversationId, table.status),
}));

export const insertWhatsappFollowupSchema = createInsertSchema(whatsappFollowupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWhatsappFollowup = z.infer<typeof insertWhatsappFollowupSchema>;
export type WhatsappFollowup = typeof whatsappFollowupsTable.$inferSelect;