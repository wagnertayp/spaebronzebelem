import assert from "node:assert/strict";
import test from "node:test";
import { createEvolutionInstanceStore } from "../src/lib/evolution-instance-store.ts";

test("uses the legacy environment instance until a selection is saved", async () => {
  let saved = null;
  const store = createEvolutionInstanceStore({
    legacyInstance: " spa-legacy ",
    repository: {
      async load() {
        return saved;
      },
      async save(instanceName) {
        saved = { instanceName };
      },
    },
  });

  assert.equal(await store.getSelectedInstance(), "spa-legacy");
  await store.setSelectedInstance("spa-new");
  assert.equal(await store.getSelectedInstance(), "spa-new");
});

test("a persisted null selection clears the legacy environment instance", async () => {
  let saved = null;
  const store = createEvolutionInstanceStore({
    legacyInstance: "spa-legacy",
    repository: {
      async load() {
        return saved;
      },
      async save(instanceName) {
        saved = { instanceName };
      },
    },
  });

  await store.setSelectedInstance(null);
  assert.equal(await store.getSelectedInstance(), null);
});