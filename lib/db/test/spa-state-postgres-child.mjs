import { createSpaOperationalStateStore } from "../../../artifacts/api-server/src/lib/spa-state-store.ts";
import {
  createPostgresRepository,
  createTestPool,
} from "./spa-state-postgres-support.mjs";

const pool = createTestPool();
const state = { value: { clients: [], appointments: [] } };
const store = createSpaOperationalStateStore({
  repository: createPostgresRepository(pool),
  createSnapshot: () => structuredClone(state.value),
  restoreSnapshot: (snapshot) => {
    state.value = structuredClone(snapshot);
  },
  importApproved: false,
});

try {
  await store.ensureLoaded();
  if (store.status !== "ready") {
    throw new Error("A fresh process did not load the saved SPA state.");
  }
  process.stdout.write(JSON.stringify(state.value));
} finally {
  await pool.end();
}