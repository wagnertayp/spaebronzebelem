---
name: WhatsApp PDF assets
description: File lookup behavior for PDFs sent through the Evolution WhatsApp integration.
---

The API workflow can run with `artifacts/api-server` as its current directory while uploaded PDFs live in the workspace-level `attached_assets` directory.

**Why:** Directly resolving `attached_assets` from `process.cwd()` caused `ENOENT`, so both PDF document messages were marked failed even though the files existed.

**How to apply:** Resolve document assets from both the current directory and the workspace-level path before sending them to Evolution, and preserve the provider error in the message record for diagnosis.