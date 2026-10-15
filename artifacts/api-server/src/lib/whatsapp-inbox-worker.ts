export type DurableInboxJob<Payload> = {
  id: number;
  eventKey: string;
  payload: Payload;
  attempts: number;
  leaseToken: string;
};

export type DurableInboxWorkerStore<Payload> = {
  claim: () => Promise<DurableInboxJob<Payload> | null>;
  renewLease: (job: DurableInboxJob<Payload>) => Promise<void>;
  complete: (job: DurableInboxJob<Payload>) => Promise<boolean>;
  retry: (job: DurableInboxJob<Payload>, error: unknown) => Promise<void>;
  releaseUnstarted: (job: DurableInboxJob<Payload>) => Promise<void>;
};

type WorkerLogger = {
  info: (context: Record<string, unknown>, message: string) => void;
  warn: (context: Record<string, unknown>, message: string) => void;
  error: (context: Record<string, unknown>, message: string) => void;
};

export const createDurableInboxWorker = <Payload, Result>({
  store,
  processPayload,
  logger,
  concurrency,
  pollIntervalMs,
  heartbeatIntervalMs,
}: {
  store: DurableInboxWorkerStore<Payload>;
  processPayload: (payload: Payload, job: { id: number }) => Promise<Result>;
  logger: WorkerLogger;
  concurrency: number;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
}) => {
  let stopping = false;
  let activeRuns = 0;
  const inFlight = new Set<Promise<void>>();

  const runOne = async () => {
    if (stopping || activeRuns >= concurrency) return;
    activeRuns += 1;
    try {
      const job = await store.claim();
      if (!job) return;
      if (stopping) {
        await store.releaseUnstarted(job);
        return;
      }

      const heartbeat = setInterval(() => {
        void store.renewLease(job).catch((error) => {
          logger.error({ err: error, inboxId: job.id }, "WhatsApp inbox lease renewal failed");
        });
      }, heartbeatIntervalMs);
      heartbeat.unref();

      try {
        const result = await processPayload(job.payload, { id: job.id });
        const completed = await store.complete(job);
        if (completed) {
          logger.info(
            { inboxId: job.id, eventKey: job.eventKey, result },
            "WhatsApp webhook inbox item processed",
          );
        } else {
          logger.warn(
            { inboxId: job.id, eventKey: job.eventKey },
            "WhatsApp webhook inbox lease was lost before completion",
          );
        }
      } catch (error) {
        await store.retry(job, error);
        logger.error(
          { err: error, inboxId: job.id, attempt: job.attempts },
          "WhatsApp webhook processing failed; the event will be retried",
        );
      } finally {
        clearInterval(heartbeat);
      }
    } catch (error) {
      logger.error({ err: error }, "WhatsApp webhook inbox worker cycle failed");
    } finally {
      activeRuns -= 1;
    }
  };

  const launch = () => {
    if (stopping || activeRuns >= concurrency) return;
    const task = runOne();
    inFlight.add(task);
    void task.finally(() => inFlight.delete(task));
  };

  launch();
  const poller = setInterval(launch, pollIntervalMs);
  poller.unref();

  return {
    stop: async (drainTimeoutMs = 20_000): Promise<boolean> => {
      stopping = true;
      clearInterval(poller);
      if (!inFlight.size) return true;

      let timeout: ReturnType<typeof setTimeout> | undefined;
      const drained = await Promise.race([
        Promise.all([...inFlight]).then(() => true),
        new Promise<boolean>((resolve) => {
          timeout = setTimeout(() => resolve(false), drainTimeoutMs);
        }),
      ]);
      if (timeout) clearTimeout(timeout);
      return drained;
    },
  };
};
