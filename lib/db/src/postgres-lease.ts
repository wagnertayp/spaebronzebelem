import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type PostgresLease = (() => Promise<void>) & {
  assertHeld: () => Promise<void>;
};

const DEFAULT_LEASE_TTL_MS = 60_000;
const DEFAULT_RENEW_INTERVAL_MS = 15_000;
const LEASE_TABLE = '"app_coordination_leases"';

export const tryAcquirePostgresLease = async (
  pool: Pick<Pool, "query">,
  key: string,
  ttlMs = DEFAULT_LEASE_TTL_MS,
): Promise<PostgresLease | null> => {
  const ownerToken = randomUUID();
  const acquired = await pool.query<{ owner_token: string }>(
    `INSERT INTO ${LEASE_TABLE} (lock_key, owner_token, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 millisecond'))
     ON CONFLICT (lock_key) DO UPDATE
       SET owner_token = EXCLUDED.owner_token,
           expires_at = EXCLUDED.expires_at
       WHERE ${LEASE_TABLE}.expires_at <= now()
     RETURNING owner_token`,
    [key, ownerToken, ttlMs],
  );
  if (acquired.rows[0]?.owner_token !== ownerToken) return null;

  let released = false;
  let lostError: Error | null = null;
  let renewal: Promise<void> | null = null;

  const renew = async () => {
    if (released || lostError || renewal) return;
    renewal = (async () => {
      const result = await pool.query<{ owner_token: string }>(
        `UPDATE ${LEASE_TABLE}
         SET expires_at = now() + ($3 * interval '1 millisecond')
         WHERE lock_key = $1 AND owner_token = $2 AND expires_at > now()
         RETURNING owner_token`,
        [key, ownerToken, ttlMs],
      );
      if (result.rows[0]?.owner_token !== ownerToken) {
        throw new Error(`Database lease ownership was lost for "${key}".`);
      }
    })()
      .catch((error: unknown) => {
        lostError = error instanceof Error
          ? error
          : new Error(`Could not renew database lease "${key}".`);
      })
      .finally(() => {
        renewal = null;
      });
    await renewal;
  };

  const heartbeat = setInterval(() => {
    void renew();
  }, DEFAULT_RENEW_INTERVAL_MS);
  heartbeat.unref?.();

  const release = (async () => {
    if (released) return;
    released = true;
    clearInterval(heartbeat);
    await renewal;
    const result = await pool.query<{ lock_key: string }>(
      `DELETE FROM ${LEASE_TABLE}
       WHERE lock_key = $1 AND owner_token = $2
       RETURNING lock_key`,
      [key, ownerToken],
    );
    if (result.rowCount !== 1 && !lostError) {
      lostError = new Error(`Database lease ownership was lost for "${key}" before release.`);
    }
    if (lostError) throw lostError;
  }) as PostgresLease;

  release.assertHeld = async () => {
    if (lostError) throw lostError;
    if (released) throw new Error(`Database lease "${key}" has already been released.`);
    try {
      const result = await pool.query<{ owner_token: string }>(
        `SELECT owner_token
         FROM ${LEASE_TABLE}
         WHERE lock_key = $1 AND owner_token = $2 AND expires_at > now()`,
        [key, ownerToken],
      );
      if (result.rows[0]?.owner_token !== ownerToken) {
        throw new Error(`Database lease ownership was lost for "${key}".`);
      }
    } catch (error) {
      lostError = error instanceof Error
        ? error
        : new Error(`Could not verify database lease "${key}".`);
      throw lostError;
    }
  };

  return release;
};

export const acquirePostgresLease = async (
  pool: Pick<Pool, "query">,
  key: string,
  options: { ttlMs?: number; waitMs?: number } = {},
): Promise<PostgresLease> => {
  const ttlMs = options.ttlMs ?? DEFAULT_LEASE_TTL_MS;
  const waitMs = options.waitMs ?? 25_000;
  const deadline = Date.now() + waitMs;
  let delayMs = 100;

  while (true) {
    const lease = await tryAcquirePostgresLease(pool, key, ttlMs);
    if (lease) return lease;
    if (Date.now() >= deadline) {
      throw new Error(`Could not acquire database lease "${key}" within ${waitMs}ms.`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(delayMs * 2, 750);
  }
};
