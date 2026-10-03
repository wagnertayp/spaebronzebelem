# Heroku deployment

This repository is a pnpm monorepo. The Heroku build uses the root lockfile,
builds the SPA at `/`, bundles the Express API, and serves both from one app so
the browser and API share an origin.

## Build and process model

- Heroku Node.js buildpack: Node 24 and the exact pnpm version are pinned in the
  root `package.json`.
- `heroku-postbuild` builds `@workspace/spa-bronze-belem` and `@workspace/api-server`.
- `Procfile` starts the API on Heroku's assigned `PORT`; in production it also
  serves the SPA and its client-side routes.
- Keep exactly one `web` dyno for now. The webhook inbox is database-backed and
  safe for multiple consumers, but reminder/follow-up loops and several business
  records are still process-local; extra dynos can duplicate scheduled sends
  and make each dyno show different data.
- Voice-note conversion shells out to `ffmpeg`. The root `Aptfile` installs it;
  configure Heroku's Apt buildpack before the Node.js buildpack.

## Required configuration

Attach a **new Heroku Postgres database** to the app so Heroku provides
`DATABASE_URL`. Do not point this deployment at the Replit database or assume
that Heroku copies its records.

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

Heroku assigns `PORT` at runtime. Do not set it as a fixed Config Var.

## First deployment and checks

1. Create the Heroku app, attach its Postgres add-on, and configure the Apt and
   Node.js buildpacks. Keep the Apt buildpack before the Node.js buildpack.
2. Set the Config Vars above. Keep all credentials in Heroku Config Vars; do not
   commit them or copy Replit secret values into this document.
3. Deploy the repository. The `release` process applies the checked-in Drizzle
   migrations to the configured Heroku database before the web dyno starts.
4. Scale to one web dyno and confirm `https://<app-domain>/api/healthz` returns
   successfully and the root URL loads the panel.
5. Confirm the Evolution webhook points to the Heroku URL, then test one inbound
   WhatsApp message before enabling normal automation.

## Data durability limitation

The current database schema persists WhatsApp conversations, messages, settings,
and follow-ups. Core operational records—including appointments, clients,
professionals, services, quotes, inventory, financial movements, and commission
records—are still mutable in-memory collections, with some initial values read
from the bundled backup JSON. Heroku can restart dynos during normal operation;
those mutations are therefore **not durable** and can revert to their startup
data. A single dyno avoids cross-dyno divergence but does not solve restart loss.

Do not use this deployment for live operations until those records are moved to
PostgreSQL and the existing records that must be retained are deliberately
exported/imported. The checked-in migration currently creates only the existing
WhatsApp tables; it does not migrate Replit database contents or the in-memory
business records. No automatic `drizzle-kit push` or force-push is used.