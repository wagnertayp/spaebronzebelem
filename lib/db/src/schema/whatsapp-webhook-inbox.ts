import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const whatsappWebhookInboxTable = pgTable(
  "whatsapp_webhook_inbox",
  {
    id: serial("id").primaryKey(),
    eventKey: text("event_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    leaseToken: text("lease_token"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("whatsapp_webhook_inbox_event_key_unique").on(table.eventKey),
    index("whatsapp_webhook_inbox_pending_idx").on(
      table.status,
      table.availableAt,
      table.createdAt,
    ),
  ],
);

export type WhatsappWebhookInboxItem = typeof whatsappWebhookInboxTable.$inferSelect;