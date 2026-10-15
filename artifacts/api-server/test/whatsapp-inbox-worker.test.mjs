import assert from "node:assert/strict";
import test from "node:test";
import { createDurableInboxWorker } from "../src/lib/whatsapp-inbox-worker.ts";
import { persistWhatsappWebhookBeforeAcknowledgement } from "../src/lib/whatsapp-webhook-acknowledgement.ts";

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

test("Evolution receives 503 when the durable inbox insert fails", async () => {
  const failure = new Error("database unavailable");
  const acknowledgement = await persistWhatsappWebhookBeforeAcknowledgement({
    eventKey: "provider-message-1",
    payload: { text: "hello" },
    enqueue: async () => { throw failure; },
  });

  assert.equal(acknowledgement.statusCode, 503);
  assert.deepEqual(acknowledgement.body, {
    error: "Não foi possível registrar a mensagem para processamento.",
  });
  assert.equal(acknowledgement.error, failure);
});

test("a duplicate already in the durable inbox may be acknowledged without another insert", async () => {
  const acknowledgement = await persistWhatsappWebhookBeforeAcknowledgement({
    eventKey: "provider-message-1",
    payload: { text: "hello" },
    enqueue: async () => false,
  });

  assert.equal(acknowledgement.statusCode, 200);
  assert.deepEqual(acknowledgement.body, {
    received: true,
    action: "duplicate_queued",
  });
});

test("a transient lease renewal failure is logged and a later renewal can keep the job alive", async () => {
  let claims = 0;
  let renewals = 0;
  let completed = 0;
  let renewalErrors = 0;
  let markCompleted;
  const didComplete = new Promise((resolve) => { markCompleted = resolve; });
  const testLogger = {
    ...logger,
    error(context, message) {
      if (message === "WhatsApp inbox lease renewal failed") renewalErrors += 1;
    },
  };
  const store = {
    async claim() {
      claims += 1;
      return claims === 1 ? job(11) : null;
    },
    async renewLease() {
      renewals += 1;
      if (renewals === 1) throw new Error("temporary database outage");
    },
    async complete() {
      completed += 1;
      markCompleted();
      return true;
    },
    async retry() {},
    async releaseUnstarted() {},
  };
  const worker = createDurableInboxWorker(workerOptions(
    store,
    async () => {
      await delay(30);
      return "processed";
    },
    { logger: testLogger, heartbeatIntervalMs: 5 },
  ));

  await didComplete;
  assert.equal(await worker.stop(500), true);
  assert.ok(renewals >= 2);
  assert.equal(renewalErrors, 1);
  assert.equal(completed, 1);
});

test("a completion database failure is recovered after lease expiry without duplicating an appointment", async () => {
  let state = "pending";
  let lockedAt = 0;
  let completionFailed = false;
  let retryCalls = 0;
  let claims = 0;
  const processedProviderMessages = new Set();
  let appointmentsCreated = 0;
  let firstCompletionFailed;
  const failed = new Promise((resolve) => { firstCompletionFailed = resolve; });
  let secondCompletion;
  const recovered = new Promise((resolve) => { secondCompletion = resolve; });

  const store = {
    async claim() {
      const expired = state === "processing" && Date.now() - lockedAt >= 30;
      if (state !== "pending" && !expired) return null;
      state = "processing";
      lockedAt = Date.now();
      claims += 1;
      return {
        ...job(12, `lease-${claims}`),
        payload: { providerMessageId: "provider-message-12" },
      };
    },
    async renewLease(currentJob) {
      if (state === "processing" && currentJob.leaseToken === `lease-${claims}`) {
        lockedAt = Date.now();
      }
    },
    async complete(currentJob) {
      if (!completionFailed) {
        completionFailed = true;
        firstCompletionFailed();
        throw new Error("completion transaction could not reach PostgreSQL");
      }
      if (state !== "processing" || currentJob.leaseToken !== `lease-${claims}`) return false;
      state = "done";
      secondCompletion();
      return true;
    },
    async retry() {
      retryCalls += 1;
      state = "pending";
    },
    async releaseUnstarted() {
      state = "pending";
    },
  };
  const processPayload = async (payload) => {
    if (!processedProviderMessages.has(payload.providerMessageId)) {
      processedProviderMessages.add(payload.providerMessageId);
      appointmentsCreated += 1;
    }
    return "processed";
  };
  const firstWorker = createDurableInboxWorker(workerOptions(
    store,
    processPayload,
    { heartbeatIntervalMs: 10_000 },
  ));
  await failed;
  assert.equal(await firstWorker.stop(500), true);
  assert.equal(retryCalls, 0, "a completed side effect must not be immediately requeued on completion failure");

  await delay(35);
  const secondWorker = createDurableInboxWorker(workerOptions(
    store,
    processPayload,
    { heartbeatIntervalMs: 10_000 },
  ));
  await recovered;
  assert.equal(await secondWorker.stop(500), true);
  assert.equal(claims, 2);
  assert.equal(appointmentsCreated, 1, "the provider-message idempotency key prevents duplicate scheduling");
  assert.equal(state, "done");
});
