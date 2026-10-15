import app from "./app";
import { logger } from "./lib/logger";
import { startWhatsappBackgroundServices } from "./routes/spa";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (process.env["NODE_ENV"] === "production") {
  const memoryLimitMb = Number(process.env["DYNO_MEMORY_LIMIT_MB"] ?? 512);
  const memoryWarnPercent = Number(process.env["WHATSAPP_WORKER_MEMORY_WARN_PERCENT"] ?? 80);
  if (!Number.isFinite(memoryLimitMb) || memoryLimitMb <= 0) {
    throw new Error("DYNO_MEMORY_LIMIT_MB must be a positive number.");
  }
  if (!Number.isFinite(memoryWarnPercent) || memoryWarnPercent <= 0 || memoryWarnPercent > 100) {
    throw new Error("WHATSAPP_WORKER_MEMORY_WARN_PERCENT must be between 0 and 100.");
  }
  const reportWebMemory = () => {
    const memory = process.memoryUsage();
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;
    const context = {
      processType: "web",
      dyno: process.env["DYNO"] ?? "unknown",
      pid: process.pid,
      rssMb: toMb(memory.rss),
      heapUsedMb: toMb(memory.heapUsed),
      externalMb: toMb(memory.external),
      arrayBuffersMb: toMb(memory.arrayBuffers),
      memoryLimitMb,
    };
    if (context.rssMb >= memoryLimitMb * memoryWarnPercent / 100) {
      logger.warn(context, "Web dyno memory threshold exceeded");
    } else {
      logger.info(context, "Web dyno memory");
    }
  };
  void reportWebMemory();
  const webMemoryInterval = setInterval(reportWebMemory, 60_000);
  webMemoryInterval.unref();
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  if (process.env["NODE_ENV"] !== "production") {
    startWhatsappBackgroundServices();
  }
});
