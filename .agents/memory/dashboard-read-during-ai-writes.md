---
name: Dashboard reads during AI writes
description: Keep dashboard list endpoints responsive during synchronous provider-backed mutations.
---

For dashboard list reads, load the latest committed operational snapshot into request-local response data rather than awaiting the in-process write queue or restoring fresh data into module-level arrays.

**Why:** The Evolution webhook can hold process and database write locks while awaiting external AI or provider calls. Waiting can turn dashboard refreshes into Heroku 30-second timeouts; refreshing shared arrays during an uncommitted write can discard in-progress changes. Returning the last committed snapshot preserves consistency while accepting brief staleness.

**How to apply:** Extend the request-local snapshot approach when other independent read endpoints need the same availability. Do not remove write serialization or refresh shared mutable arrays concurrently. Keep external AI calls bounded; a durable webhook inbox and worker is the long-term way to avoid holding locks across network calls.