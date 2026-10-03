import assert from "node:assert/strict";
import test from "node:test";
import { tryAcquirePostgresAdvisoryLock } from "../../../lib/db/src/postgres-advisory-lock.ts";

const createPool = ({ acquired = true, failOnAcquire = false } = {}) => {
  const calls = [];
  const releases = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (failOnAcquire && sql.includes("pg_try_advisory_lock")) {
        throw new Error("database unavailable");
      }
      return {
        rows: [
          sql.includes("pg_try_advisory_lock")
            ? { acquired }
            : { unlocked: true },
        ],
      };
    },
    release(error) {
      releases.push(error);
    },
  };
  return {
    calls,
    releases,
    pool: { connect: async () => client },
  };
};

test("try-lock releases a held PostgreSQL advisory lock exactly once", async () => {
  const { pool, calls, releases } = createPool();
  const release = await tryAcquirePostgresAdvisoryLock(pool, [139777, 2]);

  assert.equal(typeof release, "function");
  await release();
  await release();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].params, [139777, 2]);
  assert.match(calls[0].sql, /pg_try_advisory_lock/);
  assert.match(calls[1].sql, /pg_advisory_unlock/);
  assert.equal(releases.length, 1);
});

test("try-lock returns null and releases the connection when another worker owns it", async () => {
  const { pool, calls, releases } = createPool({ acquired: false });

  assert.equal(await tryAcquirePostgresAdvisoryLock(pool, [139777, 2]), null);
  assert.equal(calls.length, 1);
  assert.equal(releases.length, 1);
  assert.equal(releases[0], undefined);
});

test("try-lock releases a broken connection and rethrows database failures", async () => {
  const { pool, releases } = createPool({ failOnAcquire: true });

  await assert.rejects(
    tryAcquirePostgresAdvisoryLock(pool, [139777, 2]),
    /database unavailable/,
  );
  assert.equal(releases.length, 1);
  assert.equal(releases[0]?.message, "database unavailable");
});