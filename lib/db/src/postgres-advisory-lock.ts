import type { Pool } from "pg";

export const tryAcquirePostgresAdvisoryLock = async (
  pool: Pick<Pool, "connect">,
  key: readonly [number, number],
) => {
  const client = await pool.connect();
  try {
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1, $2) AS acquired",
      [...key],
    );
    if (result.rows[0]?.acquired !== true) {
      client.release();
      return null;
    }
  } catch (error) {
    client.release(error instanceof Error ? error : new Error("Could not acquire PostgreSQL advisory lock."));
    throw error;
  }

  let released = false;
  return async () => {
    if (released) return;
    released = true;
    let releaseError: Error | undefined;
    try {
      const result = await client.query<{ unlocked: boolean }>(
        "SELECT pg_advisory_unlock($1, $2) AS unlocked",
        [...key],
      );
      if (result.rows[0]?.unlocked !== true) {
        throw new Error("PostgreSQL advisory lock was not held by the current connection.");
      }
    } catch (error) {
      releaseError = error instanceof Error
        ? error
        : new Error("Could not release PostgreSQL advisory lock.");
      throw error;
    } finally {
      client.release(releaseError);
    }
  };
};