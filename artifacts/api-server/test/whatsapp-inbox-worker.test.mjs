import assert from "node:assert/strict";
import test from "node:test";
import { createDurableInboxWorker } from "../src/lib/whatsapp-inbox-worker.ts";

const logger = {
  info() {},
  warn() {},
  error() {},
};

const job = (id, leaseToken = `lease-${id}`) => ({
  id,
  eventKey: `event-${id}`,
  payload: { id },
  attempts: 1,
  leaseToken,
});

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const until = async (predicate, timeoutMs = 1_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for worker state.");
    await delay(5);
  }
};

const workerOptions = (store, processPayload, overrides = {}) => ({
  store,
  processPayload,
  logger,
  concurrency: 1,
  pollIntervalMs: 5,
  heartbeatIntervalMs: 1_000,
  ...overrides,
});

test("SIGTERM stops new claims and drains an active webhook before returning", async () => {
  let claims = 0;
  let releaseProcessing;
  let markStarted;
  const started = new Promise((resolve) => { markStarted = resolve; });
  const processing = new Promise((resolve) => { releaseProcessing = resolve; });
  const completed = [];

  const store = {
    async claim() {
      claims += 1;
      return claims === 1 ? job(1) : null;
    },
    async renewLease() {},
    async complete(currentJob) {
      completed.push(currentJob.id);
      return true;
    },
    async retry() {},
    async releaseUnstarted() {},
  };

  const worker = createDurableInboxWorker(workerOptions(store, async () => {
    markStarted();
    await processing;
    return "replied";
  }));
  await started;

  const stopping = worker.stop(500);
  await delay(20);
  assert.equal(claims, 1, "the poller must not claim more work after stop starts");
  releaseProcessing();
  assert.equal(await stopping, true);
  assert.deepEqual(completed, [1]);
});

test("a job claimed during shutdown is returned to pending without processing", async () => {
  let resolveClaim;
  let processingCalls = 0;
  let released = 0;
  const claimResult = new Promise((resolve) => { resolveClaim = resolve; });
  const store = {
    claim: () => claimResult,
    async renewLease() {},
    async complete() { return true; },
    async retry() {},
    async releaseUnstarted() { released += 1; },
  };

  const worker = createDurableInboxWorker(workerOptions(store, async () => {
    processingCalls += 1;
  }));
  const stopping = worker.stop(500);
  resolveClaim(job(2));

  assert.equal(await stopping, true);
  assert.equal(released, 1);
  assert.equal(processingCalls, 0);
});

test("an expired lease can be reclaimed after a worker restart and the queue drains", async () => {
  let state = "pending";
  let tokenNumber = 0;
  let lockedAt = 0;
  let completionCount = 0;
  let releaseOldProcessing;
  let markOldStarted;
  const oldStarted = new Promise((resolve) => { markOldStarted = resolve; });
  const oldProcessing = new Promise((resolve) => { releaseOldProcessing = resolve; });
  let markNewCompleted;
  const newCompleted = new Promise((resolve) => { markNewCompleted = resolve; });

  const store = {
    async claim() {
      const leaseExpired = state === "processing" && Date.now() - lockedAt >= 25;
      if (state !== "pending" && !leaseExpired) return null;
      state = "processing";
      lockedAt = Date.now();
      tokenNumber += 1;
      return job(3, `lease-${tokenNumber}`);
    },
    async renewLease(currentJob) {
      if (state === "processing" && currentJob.leaseToken === `lease-${tokenNumber}`) {
        lockedAt = Date.now();
      }
    },
    async complete(currentJob) {
      if (state !== "processing" || currentJob.leaseToken !== `lease-${tokenNumber}`) {
        return false;
      }
      state = "done";
      completionCount += 1;
      markNewCompleted();
      return true;
    },
    async retry() {
      state = "pending";
    },
    async releaseUnstarted() {
      state = "pending";
    },
  };

  const firstWorker = createDurableInboxWorker(workerOptions(
    store,
    async () => {
      markOldStarted();
      await oldProcessing;
      return "old attempt";
    },
    { heartbeatIntervalMs: 10_000 },
  ));
  await oldStarted;
  assert.equal(await firstWorker.stop(2), false, "the old worker should hit its drain deadline");

  await delay(35);
  const secondWorker = createDurableInboxWorker(workerOptions(store, async () => {
    return "recovered";
  }));
  await newCompleted;
  assert.equal(await secondWorker.stop(100), true);

  releaseOldProcessing();
  assert.equal(await firstWorker.stop(100), true);
  assert.equal(state, "done");
  assert.equal(completionCount, 1, "the expired lease owner must not overwrite the recovered result");
});
