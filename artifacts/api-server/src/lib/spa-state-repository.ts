import { eq } from "drizzle-orm";
import { db, pool, spaOperationalStateTable, tryAcquirePostgresAdvisoryLock } from "@workspace/db";
import type { SpaOperationalStateRepository } from "./spa-state-store";

const SPA_STATE_ADVISORY_LOCK_KEY = [139777, 1] as const;
const WHATSAPP_REMINDER_ADVISORY_LOCK_KEY = [139777, 2] as const;

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

export const acquireSpaOperationalStateLock = async () => {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1, $2)", [...SPA_STATE_ADVISORY_LOCK_KEY]);
  } catch (error) {
    client.release(error instanceof Error ? error : new Error("Could not acquire SPA state lock."));
    throw error;
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    let releaseError: Error | undefined;
    try {
      await client.query("SELECT pg_advisory_unlock($1, $2)", [...SPA_STATE_ADVISORY_LOCK_KEY]);
    } catch (error) {
      releaseError = error instanceof Error ? error : new Error("Could not release SPA state lock.");
      throw error;
    } finally {
      client.release(releaseError);
    }
  };
};

export const tryAcquireWhatsappReminderLock = async () => {
  return tryAcquirePostgresAdvisoryLock(pool, WHATSAPP_REMINDER_ADVISORY_LOCK_KEY);
};