import { logger } from "./lib/logger";
import { startWhatsappBackgroundServices } from "./routes/spa";

logger.info(
  { concurrencyPerDyno: process.env["WHATSAPP_WEBHOOK_WORKER_CONCURRENCY"] ?? 2 },
  "WhatsApp background worker started",
);

startWhatsappBackgroundServices({ keepAlive: true });
