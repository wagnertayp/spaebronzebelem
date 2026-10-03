import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  makeWhatsappWebhookEventKey,
  stripInlineMedia,
  webhookRetryDelaySeconds,
} from "./whatsapp-webhook-utils";

const CLAIM_LEASE_SECONDS = 120;
const HEARTBEAT_INTERVAL_MS = 15_000;
const WORKER_POLL_INTERVAL_MS = 1_000;

export type WhatsappWebhookPayload = Record<string, unknown>;
export type WhatsappWebhookJobContext = Pick<WhatsappWebhookJob, "id">;

export type WhatsappWebhookJob = {
  id: number;
  eventKey: string;
  payload: WhatsappWebhookPayload;
  attempts: number;
  leaseToken: string;
};

export { makeWhatsappWebhookEventKey };

const remotePhoneDigitsSql = (alias: string) => `
  regexp_replace(
    split_part(
      COALESCE(
        ${alias}.payload #>> '{data,key,remoteJid}',
        ${alias}.payload #>> '{key,remoteJid}',
        ''
      ),
      '@',
      1
    ),
    '[^0-9]',
    '',
    'g'
  )
`;

export const enqueueWhatsappWebhook = async (
  eventKey: string,
  payload: WhatsappWebhookPayload,
): Promise<boolean> => {
  const result = await pool.query(
    `INSERT INTO whatsapp_webhook_inbox (event_key, payload)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [eventKey, JSON.stringify(stripInlineMedia(payload))],
  );
  return result.rowCount === 1;
};

const claimNextWhatsappWebhook = async (): Promise<WhatsappWebhookJob | null> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const candidate = await client.query<{
      id: number;
      event_key: string;
      payload: WhatsappWebhookPayload;
      attempts: number;
    }>(
      `SELECT candidate.id, candidate.event_key, candidate.payload, candidate.attempts
       FROM whatsapp_webhook_inbox AS candidate
       WHERE (
         (candidate.status = 'pending' AND candidate.available_at <= NOW())
         OR (
           candidate.status = 'processing'
           AND candidate.locked_at < NOW() - ($1 * INTERVAL '1 second')
         )
       )
       AND (
         NULLIF(${remotePhoneDigitsSql("candidate")}, '') IS NULL
         OR NOT EXISTS (
           SELECT 1
           FROM whatsapp_webhook_inbox AS earlier
           WHERE earlier.id < candidate.id
             AND NULLIF(${remotePhoneDigitsSql("earlier")}, '') =
                 NULLIF(${remotePhoneDigitsSql("candidate")}, '')
             AND earlier.status IN ('pending', 'processing')
         )
       )
       ORDER BY candidate.available_at, candidate.id
       LIMIT 1
       FOR UPDATE OF candidate SKIP LOCKED`,
      [CLAIM_LEASE_SECONDS],
    );
    const item = candidate.rows[0];
    if (!item) {
      await client.query("COMMIT");
      return null;
    }

    const leaseToken = randomUUID();
    const claimed = await client.query(
      `UPDATE whatsapp_webhook_inbox
       SET status = 'processing',
           attempts = attempts + 1,
           locked_at = NOW(),
           lease_token = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [item.id, leaseToken],
    );
    if (claimed.rowCount !== 1) {
      throw new Error("Could not claim WhatsApp webhook inbox item");
    }
    await client.query("COMMIT");
    return {
      id: item.id,
      eventKey: item.event_key,
      payload: item.payload,
      attempts: item.attempts + 1,
      leaseToken,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const hasLaterWhatsappWebhookForPhone = async (
  remoteJid: string,
  currentJobId: number,
) => {
  const phoneDigits = remoteJid.split("@")[0]?.replace(/\D/g, "") ?? "";
  if (!phoneDigits) return false;

  const result = await pool.query<{ hasLater: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM whatsapp_webhook_inbox AS queued
       WHERE queued.id > $2
         AND queued.status IN ('pending', 'processing')
         AND ${remotePhoneDigitsSql("queued")} = $1
     ) AS "hasLater"`,
    [phoneDigits, currentJobId],
  );
  return result.rows[0]?.hasLater === true;
};

export const getWhatsappWebhookPayloadByProviderMessageId = async (
  providerMessageId: string,
  remoteJid: string,
) => {
  const phoneDigits = remoteJid.split("@")[0]?.replace(/\D/g, "") ?? "";
  if (!providerMessageId || !phoneDigits) return null;

  const result = await pool.query<{ payload: WhatsappWebhookPayload }>(
    `SELECT stored.payload
     FROM whatsapp_webhook_inbox AS stored
     WHERE COALESCE(
       stored.payload #>> '{data,key,id}',
       stored.payload #>> '{key,id}'
     ) = $1
       AND ${remotePhoneDigitsSql("stored")} = $2
     ORDER BY stored.id DESC
     LIMIT 1`,
    [providerMessageId, phoneDigits],
  );
  return result.rows[0]?.payload ?? null;
};

const updateWhatsappWebhookLease = async (job: WhatsappWebhookJob) => {
  await pool.query(
    `UPDATE whatsapp_webhook_inbox
     SET locked_at = NOW(), updated_at = NOW()
     WHERE id = $1 AND status = 'processing' AND lease_token = $2`,
    [job.id, job.leaseToken],
  );
};

const completeWhatsappWebhook = async (job: WhatsappWebhookJob) => {
  const result = await pool.query(
    `UPDATE whatsapp_webhook_inbox
     SET status = 'done',
         locked_at = NULL,
         lease_token = NULL,
         last_error = NULL,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND status = 'processing' AND lease_token = $2`,
    [job.id, job.leaseToken],
  );
  return result.rowCount === 1;
};

const retryWhatsappWebhook = async (job: WhatsappWebhookJob, error: unknown) => {
  const delaySeconds = webhookRetryDelaySeconds(job.attempts);
  const message = error instanceof Error ? error.message : "Unknown webhook processing error";
  await pool.query(
    `UPDATE whatsapp_webhook_inbox
     SET status = 'pending',
         available_at = NOW() + ($3 * INTERVAL '1 second'),
         locked_at = NULL,
         lease_token = NULL,
         last_error = $4,
         updated_at = NOW()
     WHERE id = $1 AND status = 'processing' AND lease_token = $2`,
    [job.id, job.leaseToken, delaySeconds, message.slice(0, 1_000)],
  );
};

export const startWhatsappWebhookInboxWorker = (
  processPayload: (
    payload: WhatsappWebhookPayload,
    job: WhatsappWebhookJobContext,
  ) => Promise<unknown>,
) => {
  let running = false;

  const runOne = async () => {
    if (running) return;
    running = true;
    try {
      const job = await claimNextWhatsappWebhook();
      if (!job) return;

      const heartbeat = setInterval(() => {
        void updateWhatsappWebhookLease(job).catch((error) => {
          logger.error({ err: error, inboxId: job.id }, "WhatsApp inbox lease renewal failed");
        });
      }, HEARTBEAT_INTERVAL_MS);
      heartbeat.unref();

      try {
        const result = await processPayload(job.payload, { id: job.id });
        const completed = await completeWhatsappWebhook(job);
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
        await retryWhatsappWebhook(job, error);
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
      running = false;
    }
  };

  void runOne();
  const interval = setInterval(() => void runOne(), WORKER_POLL_INTERVAL_MS);
  interval.unref();
  return () => clearInterval(interval);
};