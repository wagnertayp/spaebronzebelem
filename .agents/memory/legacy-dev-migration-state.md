---
name: Legacy development migration state
description: Existing development tables are not represented in this workspace's Drizzle migration ledger.
---

The Replit development database already contains WhatsApp tables, but the Drizzle migration ledger does not record their creation. Running the standard migrator attempts to replay the first migration and fails because those relations already exist.

**Why:** blindly replaying historical migrations against a populated database is unsafe, and the external Heroku production database must not be confused with the Replit development database.

**How to apply:** before running migrations in this workspace, inspect the target and migration history. Use only narrowly scoped additive changes on the confirmed development database; do not force-push or mark historical migrations as applied without verifying the full schema. Keep Heroku migrations on its documented release path.