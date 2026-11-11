import { pool } from "@workspace/db";
import { logger } from "./lib/logger";
import { getWhatsappWebhookQueueStats } from "./lib/whatsapp-webhook-inbox";
import { startWhatsappBackgroundServices } from "./routes/spa";

const positiveNumber = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return value;
};

const memoryLimitMb = positiveNumber("DYNO_MEMORY_LIMIT_MB", 512);
const memoryWarnPercent = positiveNumber("WHATSAPP_WORKER_MEMORY_WARN_PERCENT", 80);
const pendingWarnCount = positiveNumber("WHATSAPP_QUEUE_PENDING_WARN_COUNT", 25);
const oldestPendingWarnSeconds = positiveNumber("WHATSAPP_QUEUE_OLDEST_WARN_SECONDS", 60);

if (memoryWarnPercent > 100) {
  throw new Error("WHATSAPP_WORKER_MEMORY_WARN_PERCENT must be at most 100.");
}

logger.info(
  {
    concurrencyPerDyno: process.env["WHATSAPP_WEBHOOK_WORKER_CONCURRENCY"] ?? 2,
    memoryLimitMb,
    memoryWarnPercent,
  },
  "WhatsApp background worker started",
);

const stopBackgroundServices = startWhatsappBackgroundServices({ keepAlive: true });
let reportingMetrics = false;

const reportWorkerHealth = async () => {
  if (reportingMetrics) return;
  reportingMetrics = true;
  try {
    const [queue, memory] = await Promise.all([
      getWhatsappWebhookQueueStats(),
      Promise.resolve(process.memoryUsage()),
    ]);
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
    const context = {
      dyno: process.env["DYNO"] ?? "local",
      pid: process.pid,
      rssMb: toMb(memory.rss),
      heapUsedMb: toMb(memory.heapUsed),
      externalMb: toMb(memory.external),
      arrayBuffersMb: toMb(memory.arrayBuffers),
      memoryLimitMb,
      pendingCount: queue.pendingCount,
      processingCount: queue.processingCount,
      failedCount: queue.failedCount,
      oldestPendingSeconds: queue.oldestPendingSeconds,
    };
    const memoryHigh = context.rssMb >= memoryLimitMb * memoryWarnPercent / 100;
    const queueHigh =
      queue.pendingCount >= pendingWarnCount ||
      queue.oldestPendingSeconds >= oldestPendingWarnSeconds;

    if (memoryHigh || queueHigh) {
      logger.warn(
        { ...context, memoryHigh, queueHigh },
        "WhatsApp worker health threshold exceeded",
      );
    } else {
      logger.info(context, "WhatsApp worker health");
    }
  } catch (error) {
    logger.error({ err: error }, "Could not collect WhatsApp worker health metrics");
  } finally {
    reportingMetrics = false;
  }
};

void reportWorkerHealth();
const metricsInterval = setInterval(() => void reportWorkerHealth(), 60_000);

let shuttingDown = false;
const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(metricsInterval);
  logger.info({ signal }, "WhatsApp worker shutdown requested");
  try {
    const drained = await stopBackgroundServices(20_000);
    if (!drained) {
      logger.warn(
        { drainTimeoutMs: 20_000 },
        "Worker drain timed out; interrupted inbox jobs will recover after lease expiry",
      );
      process.exit(1);
      return;
    }
    await pool.end();
    logger.info("WhatsApp worker stopped after draining active jobs");
    process.exit(0);
  } catch (error) {
    logger.error({ err: error, signal }, "WhatsApp worker shutdown failed");
    process.exit(1);
  }
};

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
