# Initial SPA state import

The Heroku `release` process continues to run the checked-in Drizzle migrations. The new `spa_operational_state` table is created by that schema migration; it does not copy or alter business records.

Operational data is saved as one versioned PostgreSQL JSONB snapshot. Each request refreshes the snapshot from PostgreSQL, and writes are serialized with a PostgreSQL advisory lock so concurrent API processes do not overwrite each other's changes. The API does not import `spa-backup.json` automatically. In production, SPA endpoints remain unavailable until the singleton state row exists, so the app cannot silently accept in-memory-only edits or show seed records as live data.

To perform the one-time initial import:

1. Take and verify a backup of the target Heroku Postgres database.
2. Review the current `spa-backup.json` and the initial operational collections in `src/routes/spa.ts`.
3. Only after approval, set both Heroku config vars to the literal value `true`:
   - `SPA_INITIAL_BACKUP_CONFIRMED`
   - `SPA_INITIAL_IMPORT_APPROVED`
4. Restart the `web` process and make an authenticated request to the SPA API. On the first request, the API inserts the initial snapshot only if `spa_operational_state.id = 1` does not already exist.
5. Confirm the import log reports collection counts, then remove both config vars and restart the process.

The primary key and `INSERT ... ON CONFLICT DO NOTHING` make the import one-time: later deploys and repeated requests do not replace or duplicate existing operational data. If the row already exists, the database always wins over the bundled seed data. Do not set either import flag before the backup and approval are complete.

For development previews, if the new table does not exist yet, the API keeps its existing in-memory seed behavior. If the table exists but has no initialized state row, endpoints return `503` rather than accepting changes that would not persist. The missing-table fallback is disabled in production.