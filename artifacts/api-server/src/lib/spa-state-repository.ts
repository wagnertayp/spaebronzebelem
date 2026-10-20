import { eq } from "drizzle-orm";
import {
  acquirePostgresLease,
  db,
  pool,
  spaOperationalStateTable,
  tryAcquirePostgresLease,
} from "@workspace/db";
import type { SpaOperationalStateRepository } from "./spa-state-store";

const SPA_STATE_LOCK_KEY = "spa-operational-state";
const WHATSAPP_REMINDER_LOCK_KEY = "whatsapp-reminders";

export const spaOperationalStateRepository: SpaOperationalStateRepository = {
  async load() {
    const [row] = await db
      .select({
        version: spaOperationalStateTable.version,
        payload: spaOperationalStateTable.payload,
      })
      .from(spaOperationalStateTable)
      .where(eq(spaOperationalStateTable.id, 1))
      .limit(1);

    return row ?? null;
  },

  async insertIfAbsent(version, payload) {
    const inserted = await db
      .insert(spaOperationalStateTable)
      .values({ id: 1, version, payload })
      .onConflictDoNothing({ target: spaOperationalStateTable.id })
      .returning({ id: spaOperationalStateTable.id });

    return inserted.length > 0;
  },

  async save(version, payload) {
    const updated = await db
      .update(spaOperationalStateTable)
      .set({ version, payload, updatedAt: new Date() })
      .where(eq(spaOperationalStateTable.id, 1))
      .returning({ id: spaOperationalStateTable.id });

    if (updated.length === 0) {
      throw new Error("SPA state row is missing; refusing to report a successful save.");
    }
  },
};

export const acquireSpaOperationalStateLock = async () =>
  acquirePostgresLease(pool, SPA_STATE_LOCK_KEY);

export const tryAcquireWhatsappReminderLock = async () => {
  return tryAcquirePostgresLease(pool, WHATSAPP_REMINDER_LOCK_KEY);
};