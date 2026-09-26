---
name: Drizzle migration generation
description: Non-obvious Drizzle Kit constraints when generating reviewed SQL migrations.
---

Keep the migration output directory in the Drizzle config and invoke the configured package script. This Drizzle Kit version rejects `generate` when `--config` is combined with additional CLI flags such as `--out` or `--name`. The configured `out` path must be relative to the package working directory: an absolute path was incorrectly prefixed as `.//home/...` while reading snapshots. Schema generation does not need to connect to a database; use a non-production placeholder URL if the config requires `DATABASE_URL`.

**Why:** Heroku needs checked-in SQL migrations, and generating them must not query or mutate production data. Relative output paths also avoid this Drizzle Kit version's malformed absolute snapshot lookup.

**How to apply:** Keep `schema` explicitly configured, set `out` to a package-relative path such as `./migrations`, run the configured generation script with a placeholder URL, inspect the SQL and snapshot, then let the release process apply the checked-in migration.