import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createSpaOperationalStateStore } from "../../../artifacts/api-server/src/lib/spa-state-store.ts";
import {
  createPostgresRepository,
  createTestPool,
} from "./spa-state-postgres-support.mjs";

const testDatabaseUrl = process.env.SPA_TEST_DATABASE_URL;
const localTestDatabase = (() => {
  if (!testDatabaseUrl) return false;
  try {
    const url = new URL(testDatabaseUrl);
    return (
      ["localhost", "127.0.0.1", "::1"].includes(url.hostname) &&
      url.pathname.slice(1).endsWith("_test")
    );
  } catch {
    return false;
  }
})();

test(
  "committed JSONB state is visible to another session and after a process restart",
  { skip: !localTestDatabase && "Set SPA_TEST_DATABASE_URL to a local *_test database." },
  async () => {
    const pool = createTestPool();
    try {
      await pool.query("DELETE FROM spa_operational_state WHERE id = 1");

      const writerState = {
        value: {
          clients: [{ id: 701, name: "Cliente de teste" }],
          appointments: [{ id: 902, start: "2026-10-01T09:00:00" }],
        },
      };
      const writer = createSpaOperationalStateStore({
        repository: createPostgresRepository(pool),
        createSnapshot: () => structuredClone(writerState.value),
        restoreSnapshot: (snapshot) => {
          writerState.value = structuredClone(snapshot);
        },
        importApproved: true,
      });

      await writer.ensureLoaded();
      writerState.value.clients[0].name = "Alteração confirmada";
      await writer.persist();

      const secondSessionState = { value: { clients: [], appointments: [] } };
      const secondSession = createSpaOperationalStateStore({
        repository: createPostgresRepository(pool),
        createSnapshot: () => structuredClone(secondSessionState.value),
        restoreSnapshot: (snapshot) => {
          secondSessionState.value = structuredClone(snapshot);
        },
        importApproved: false,
      });
      await secondSession.ensureLoaded();
      assert.equal(secondSessionState.value.clients[0].name, "Alteração confirmada");

      writerState.value.clients[0].name = "Atualização de outra sessão";
      await writer.persist();
      await secondSession.refresh();
      assert.equal(
        secondSessionState.value.clients[0].name,
        "Atualização de outra sessão",
      );

      const child = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "./test/spa-state-postgres-child.mjs",
        ],
        {
          cwd: process.cwd(),
          encoding: "utf8",
          env: { ...process.env, SPA_TEST_DATABASE_URL: testDatabaseUrl },
        },
      );
      assert.equal(child.status, 0, child.stderr || child.error?.message);
      const afterRestart = JSON.parse(child.stdout);
      assert.deepEqual(afterRestart, writerState.value);
    } finally {
      await pool.query("DELETE FROM spa_operational_state WHERE id = 1");
      await pool.end();
    }
  },
);
