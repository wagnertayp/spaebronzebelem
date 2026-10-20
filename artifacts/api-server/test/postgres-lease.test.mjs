import assert from "node:assert/strict";
import test from "node:test";
import { tryAcquirePostgresLease } from "../../../lib/db/src/postgres-lease.ts";

const createPool = ({ acquired = true } = {}) => {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("INSERT INTO")) {
        return {
          rows: acquired ? [{ owner_token: params[1] }] : [],
          rowCount: acquired ? 1 : 0,
        };
      }
      if (sql.includes("DELETE FROM")) {
        return { rows: [{ lock_key: params[0] }], rowCount: 1 };
      }
      if (sql.includes("SELECT owner_token")) {
        return { rows: [{ owner_token: params[1] }], rowCount: 1 };
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
};

test("database lease is acquired and released by its owner token", async () => {
  const pool = createPool();
  const lease = await tryAcquirePostgresLease(pool, "test-lock");

  assert.equal(typeof lease, "function");
  assert.equal(typeof lease.assertHeld, "function");
  await lease.assertHeld();
  await lease();

  assert.equal(pool.calls.length, 3);
  assert.match(pool.calls[0].sql, /ON CONFLICT \(lock_key\) DO UPDATE/);
  assert.match(pool.calls[1].sql, /SELECT owner_token/);
  assert.match(pool.calls[2].sql, /WHERE lock_key = \$1 AND owner_token = \$2/);
  await assert.rejects(lease.assertHeld(), /already been released/);
});

test("database lease returns null while another owner has an unexpired lease", async () => {
  const pool = createPool({ acquired: false });
  assert.equal(await tryAcquirePostgresLease(pool, "test-lock"), null);
  assert.equal(pool.calls.length, 1);
});
