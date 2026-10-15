# Heroku deployment

This repository is a pnpm monorepo. The Heroku build uses the root lockfile,
builds the SPA at `/`, bundles the Express API, and serves both from one app so
the browser and API share an origin.

## Build and process model

- Heroku Node.js buildpack: Node 24 and the exact pnpm version are pinned in the
  root `package.json`.
- `heroku-postbuild` builds `@workspace/spa-bronze-belem` and `@workspace/api-server`.
- `Procfile` defines separate `web` and `worker` process types. The web process
  serves the SPA/API on Heroku's assigned `PORT`; the worker process handles
  WhatsApp inbox events, reminders, and follow-ups.
- The published app uses its existing Neon PostgreSQL database through
  `DATABASE_URL`; do not replace it with Replit's development database or a new
  Heroku Postgres database. Mutable SPA records are stored in the shared
  `spa_operational_state` snapshot and coordinated with a PostgreSQL advisory
  lock. Webhook and follow-up workers claim database-backed jobs, and reminder
  cycles use a shared lock so only one worker dyno sends reminders at a time.
- Start with one `web` and one `worker` dyno until the Neon schema, initialized
  SPA state row, and WhatsApp delivery are confirmed. After that, the suggested
  availability formation is two `web` and two `worker` dynos. Use at least
  Standard-2X for both process types initially: the observed 531 MB R14 is
  already above a 512 MB quota, while Standard-2X provides 1 GB per dyno. This
  is headroom, not a fix for a memory leak. The worker concurrency defaults to
  two jobs per dyno and can be adjusted with
  `WHATSAPP_WEBHOOK_WORKER_CONCURRENCY`. Provider delivery remains at-least-once
  if a process dies after Evolution accepts a message but before its sent
  status is saved.
- Voice-note conversion shells out to `ffmpeg`. The root `Aptfile` installs it;
  configure Heroku's Apt buildpack before the Node.js buildpack.

## Required configuration

Set `DATABASE_URL` to the existing Neon PostgreSQL database used by the
published app. Do not attach or migrate to a new Heroku Postgres database. The
application uses session-level PostgreSQL advisory locks for state writes and
reminder coordination, so use a Neon connection that preserves session locks;
do not switch to a transaction-pooling endpoint without testing those locks.

Set these values in Heroku Config Vars before starting the app:

- `NODE_ENV=production`
- `SESSION_SECRET` — stable random value of at least 32 characters. Rotating it
  signs users out.
- `SPA_ADMIN_USERNAME` and `SPA_ADMIN_PASSWORD` — production login credentials;
  production no longer falls back to the development account.
- `OPENAI_API_KEY` — direct OpenAI access for text, audio, and image features.
  `OPENAI_BASE_URL` is optional and defaults to OpenAI's API.
- `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, and `EVOLUTION_INSTANCE` as required
  by the connected Evolution instance.
- `EVOLUTION_WEBHOOK_URL` — the app's public URL ending in
  `/api/integrations/evolution/webhook`. Set this explicitly; the Replit
  development-domain fallback is disabled in production.
- `EVOLUTION_TIMEZONE=America/Belem`
- `DYNO_MEMORY_LIMIT_MB=1024` when the worker dynos use Standard-2X; the worker
  uses this to warn before approaching its memory quota.

Heroku assigns `PORT` at runtime. Do not set it as a fixed Config Var.

## First deployment and checks

1. Configure the Apt and Node.js buildpacks. Keep the Apt buildpack before the
   Node.js buildpack.
2. Confirm `DATABASE_URL` points to the existing Neon database used by the
   published app. Set the remaining Config Vars above; keep credentials in
   Heroku Config Vars and do not commit them.
3. Deploy the repository. The `release` process applies the checked-in Drizzle
   migrations to the configured Neon database before the web dyno starts.
4. Start with one web and one worker dyno, confirm the Neon schema and singleton
   SPA state row are present, then check `https://<app-domain>/api/healthz` and
   the panel. Scale gradually after checking memory, queue delay, and delivery.
5. For high availability after validation, configure
   `web=2:standard-2x worker=2:standard-2x`; keep webhook concurrency at two per
   worker to begin. Confirm the Evolution webhook points to the Heroku URL, then
   test an inbound WhatsApp message before enabling normal automation.

   Apply this formation with:

   ```sh
   heroku ps:scale web=2:standard-2x worker=2:standard-2x
   ```

   Set `DYNO_MEMORY_LIMIT_MB=1024` for Standard-2X dynos. Both web and worker
   dynos log RSS, heap, external memory, and array buffers once per minute and
   warn at 80% of this configured limit. Worker health logs additionally warn
   at 25 pending webhook events or when the oldest due event has waited 60 seconds. These
   limits can be tuned with `WHATSAPP_WORKER_MEMORY_WARN_PERCENT`,
   `WHATSAPP_QUEUE_PENDING_WARN_COUNT`, and
   `WHATSAPP_QUEUE_OLDEST_WARN_SECONDS`. On `SIGTERM`, a worker stops claiming
   events and drains active work for up to 20 seconds; an interrupted lease is
   eligible for recovery after it expires.

## Data durability

Mutable operational collections—including appointments, clients, professionals,
services, quotes, inventory, financial movements, and commissions—are persisted
in the versioned JSONB row `spa_operational_state`. Each mutation refreshes the
latest committed snapshot, takes the PostgreSQL advisory lock, and saves before
reporting success. WhatsApp conversations, messages, settings, follow-ups, and
webhook inbox jobs are persisted in their own tables.

The schema migration creates the state table but does not automatically import
the bundled seed data or copy data from another database. Production startup
fails closed until the singleton state row has been deliberately initialized.
Follow `artifacts/api-server/SPA_STATE_MIGRATION.md` for the backup and
one-time-import procedure; never enable its import flags before verifying the
Neon backup and approval.