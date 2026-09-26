import assert from "node:assert/strict";
import test from "node:test";
import { createSpaOperationalStateStore } from "../src/lib/spa-state-store.ts";

const clone = (value) => structuredClone(value);

class MemoryRepository {
  record = null;

  async load() {
    return this.record ? clone(this.record) : null;
  }

  async insertIfAbsent(version, payload) {
    if (this.record) return false;
    this.record = { version, payload: clone(payload) };
    return true;
  }

  async save(version, payload) {
    if (!this.record) throw new Error("missing row");
    this.record = { version, payload: clone(payload) };
  }
}

const createStore = (repository, state, importApproved = false) =>
  createSpaOperationalStateStore({
    repository,
    createSnapshot: () => clone(state.value),
    restoreSnapshot: (snapshot) => {
      state.value = clone(snapshot);
    },
    importApproved,
  });

test("restores committed changes for a new session and a restarted process", async () => {
  const repository = new MemoryRepository();
  const firstProcess = {
    value: {
      clients: [{ id: 7, name: "Cliente de teste" }],
      appointments: [{ id: 12, start: "2026-10-01T09:00:00" }],
    },
  };

  const firstStore = createStore(repository, firstProcess, true);
  await firstStore.ensureLoaded();
  firstProcess.value.clients[0].name = "Cliente atualizado";
  await firstStore.persist();

  const secondSession = { value: { clients: [], appointments: [] } };
  const secondSessionStore = createStore(repository, secondSession);
  await secondSessionStore.ensureLoaded();
  assert.equal(secondSession.value.clients[0].name, "Cliente atualizado");
  assert.equal(secondSession.value.appointments[0].id, 12);

  // A new store instance models an API process after restart.
  const restartedProcess = { value: { clients: [], appointments: [] } };
  const restartedStore = createStore(repository, restartedProcess);
  await restartedStore.ensureLoaded();
  assert.deepEqual(restartedProcess.value, secondSession.value);
});

test("does not import or overwrite a snapshot without both approval gates", async () => {
  const repository = new MemoryRepository();
  const unapprovedState = { value: { clients: [{ id: 1, name: "Seed" }] } };
  const unapprovedStore = createStore(repository, unapprovedState);

  await unapprovedStore.ensureLoaded();
  assert.equal(unapprovedStore.status, "not_initialized");
  assert.equal(repository.record, null);
  await assert.rejects(unapprovedStore.persist, /not been initialized/);

  const approvedStore = createStore(repository, unapprovedState, true);
  await approvedStore.ensureLoaded();
  assert.equal(approvedStore.importedInitialState, true);

  const laterSeed = { value: { clients: [{ id: 1, name: "Different seed" }] } };
  const repeatedImport = createStore(repository, laterSeed, true);
  await repeatedImport.ensureLoaded();
  assert.equal(repeatedImport.importedInitialState, false);
  assert.equal(laterSeed.value.clients[0].name, "Seed");
});