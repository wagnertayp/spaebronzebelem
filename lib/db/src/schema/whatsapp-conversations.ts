import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type WhatsappBookingDraft = {
  service: string | null;
  date: string | null;
  time: string | null;
  professional: string | null;
  wantsBooking: boolean;
  awaitingSlotChoice: boolean;
  awaitingConfirmation: boolean;
  awaitingClientName: boolean;
};

export const whatsappConversationsTable = pgTable("whatsapp_conversations", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  clientName: text("client_name").notNull(),
  status: text("status").notNull().default("agent"),
  bookingDraft: jsonb("booking_draft").$type<WhatsappBookingDraft | null>().default(null),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappConversation = typeof whatsappConversationsTable.$inferSelect;

export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => whatsappConversationsTable.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(),
  phone: text("phone").notNull(),
  clientName: text("client_name").notNull(),
  appointmentId: integer("appointment_id"),
  text: text("text").notNull(),
  status: text("status").notNull(),
  kind: text("kind").notNull(),
  providerMessageId: text("provider_message_id"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const whatsappSettingsTable = pgTable("whatsapp_settings", {
  id: integer("id").primaryKey(),
  aiAgentConfig: jsonb("ai_agent_config").notNull(),
  whatsappAutomation: jsonb("whatsapp_automation").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;