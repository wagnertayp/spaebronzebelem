import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { attachPostgresPoolErrorHandlers } from "../src/postgres-pool-errors.ts";

test("a checked-out PostgreSQL client error is reported instead of becoming uncaught", () => {
  const pool = new EventEmitter();
  const client = new EventEmitter();
  const reported = [];
  attachPostgresPoolErrorHandlers(pool, (scope, error) => {
    reported.push({ scope, error });
  });
  pool.emit("connect", client);

  const error = new Error("Connection terminated unexpectedly");
  assert.doesNotThrow(() => client.emit("error", error));
  assert.deepEqual(reported, [{ scope: "client", error }]);
});

test("an idle PostgreSQL pool error is reported", () => {
  const pool = new EventEmitter();
  const reported = [];
  attachPostgresPoolErrorHandlers(pool, (scope, error) => {
    reported.push({ scope, error });
  });

  const error = new Error("Idle connection terminated");
  assert.doesNotThrow(() => pool.emit("error", error));
  assert.deepEqual(reported, [{ scope: "pool", error }]);
});
