---
name: Drizzle migration generation
description: Non-obvious Drizzle Kit constraints when generating reviewed SQL migrations.
---

Keep the migration output directory in the Drizzle config and invoke the configured package script. This Drizzle Kit version rejects `generate` when `--config` is combined with additional CLI flags such as `--out` or `--name`. Schema generation does not need to connect to a database; use a non-production placeholder URL if the config requires `DATABASE_URL`.

**Why:** Heroku needs checked-in SQL migrations, and generating them must not query or mutate production data.

**How to apply:** For schema changes, run the configured generation script against the local schema, inspect the SQL and snapshot, then let the release process apply the checked-in migration.