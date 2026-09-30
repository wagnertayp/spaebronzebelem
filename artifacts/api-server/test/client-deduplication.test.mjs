import assert from "node:assert/strict";
import test from "node:test";
import {
  deduplicateSeedClientRecords,
  identifyTrustedClientDuplicateGroups,
  mergeKnownSnapshotClientDuplicates,
} from "../src/lib/client-deduplication.ts";

const seedClient = (overrides = {}) => ({
  id: 1,
  name: "Ana Silva",
  phone: "(91) 98765-4321",
  orders: 3,
  revenue: 420,
  lastVisit: "10/03/2026",
  registeredAt: "05/02/2024",
  initials: "AS",
  service: "Bronze",
  status: "active",
  source: "Indicação",
  ...overrides,
});

const snapshotClient = (overrides = {}) => ({
  id: 1,
  name: "Ana Silva",
  phone: "(91) 98765-4321",
  initials: "AS",
  lastVisit: "10/03/2026",
  service: "Bronze",
  status: "active",
  source: "Indicação",
  email: "",
  notes: "",
  ...overrides,
});

test("merges only trusted seed duplicates and preserves one lifetime total", () => {
  const { records, groups, duplicateCount } = deduplicateSeedClientRecords([
    seedClient({ id: 20, name: "ANA DA SILVA", phone: "91987654321", lastVisit: "10/03/2026" }),
    seedClient({
      id: 8,
      name: "Ana da Silva",
      phone: "+55 (91) 98765-4321",
      lastVisit: "12/04/2026",
      registeredAt: "02/01/2023",
    }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(duplicateCount, 1);
  assert.equal(records.length, 1);
  assert.equal(records[0].id, 8);
  assert.equal(records[0].name, "Ana da Silva");
  assert.equal(records[0].lastVisit, "12/04/2026");
  assert.equal(records[0].registeredAt, "02/01/2023");
  assert.equal(records[0].orders, 3);
  assert.equal(records[0].revenue, 420);
});

test("keeps records separate when totals differ or identity is incomplete/shared", () => {
  const records = [
    seedClient({ id: 1 }),
    seedClient({ id: 2, orders: 4 }),
    seedClient({ id: 3, name: "Carla Silva", phone: "(91) 98765-4321" }),
    seedClient({ id: 4, name: "Ana Silva", phone: "" }),
    seedClient({ id: 5, name: "Ana Silva", phone: "1234567" }),
  ];

  assert.deepEqual(identifyTrustedClientDuplicateGroups(records), []);
  assert.equal(deduplicateSeedClientRecords(records).records.length, records.length);
});

test("merges a known saved duplicate group and returns extra IDs for reversible archiving", () => {
  const source = deduplicateSeedClientRecords([
    seedClient({ id: 4, name: "ANA SILVA" }),
    seedClient({ id: 2, name: "Ana Silva", lastVisit: "12/04/2026" }),
  ]);
  const saved = [
    snapshotClient({ id: 4, name: "ANA SILVA", notes: "Prefere horário da manhã." }),
    snapshotClient({ id: 2, name: "Ana Silva", lastVisit: "12/04/2026", notes: "Sem contato às quartas." }),
  ];

  const merged = mergeKnownSnapshotClientDuplicates(saved, source.groups);
  assert.equal(merged.duplicateCount, 1);
  assert.deepEqual(merged.mergedGroups, [{ canonicalId: 2, duplicateIds: [4] }]);
  assert.equal(merged.clients.find((client) => client.id === 2)?.lastVisit, "12/04/2026");
  assert.match(merged.clients.find((client) => client.id === 2)?.notes ?? "", /horário da manhã/);
  assert.match(merged.clients.find((client) => client.id === 2)?.notes ?? "", /quartas/);
  assert.equal(merged.clients.length, 2);

  const alreadyArchived = mergeKnownSnapshotClientDuplicates(saved, source.groups, new Set([4]));
  assert.equal(alreadyArchived.duplicateCount, 0);
});

test("does not merge saved profiles with conflicting email, service, or extra matching records", () => {
  const source = deduplicateSeedClientRecords([
    seedClient({ id: 1 }),
    seedClient({ id: 2, name: "ANA SILVA" }),
  ]);
  const conflictingEmail = [
    snapshotClient({ id: 1, email: "ana@example.com" }),
    snapshotClient({ id: 2, email: "outra@example.com" }),
  ];
  const conflictingService = [
    snapshotClient({ id: 1, service: "Bronze" }),
    snapshotClient({ id: 2, service: "Massagem" }),
  ];
  const extraMatchingClient = [
    ...conflictingEmail.map((client) => ({ ...client, email: "" })),
    snapshotClient({ id: 3 }),
  ];

  assert.equal(mergeKnownSnapshotClientDuplicates(conflictingEmail, source.groups).duplicateCount, 0);
  assert.equal(mergeKnownSnapshotClientDuplicates(conflictingService, source.groups).duplicateCount, 0);
  assert.equal(mergeKnownSnapshotClientDuplicates(extraMatchingClient, source.groups).duplicateCount, 0);
});