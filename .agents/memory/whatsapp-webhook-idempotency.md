---
name: WhatsApp webhook idempotency
description: Prevent duplicate Evolution webhook deliveries from repeating AI and scheduling side effects.
---

Deduplicate inbound Evolution events by provider message ID before transcription, AI processing, or appointment creation. Persist partial booking details across turns. Refresh operational state under a short read lock immediately before calculating offered slots or validating an exact requested time; use the professional schedule, exceptions, service duration, and current agenda. Omission from a coarse suggestion grid is not proof that a time is unavailable. Treat AI appointment fields as a proposal: validate service, professional, and local start time against current data, then calculate the end from the catalog duration on the server. Check conflicts again under the write lock when committing. After a client requests a booking or asks for available times, choosing one offered time is consent; do not ask for a second confirmation. Parse timezone-naive appointment date-times in the configured agenda timezone, not the server's default timezone, when formatting or evaluating reminder windows.

**Why:** The AI call can take long enough for another conversation to change the agenda after the webhook's initial snapshot; exact availability based on that old snapshot can be wrong.

**How to apply:** Keep the read lock short and outside model/provider calls. Always recheck availability inside the write lock before creating an appointment.

Production must set `EVOLUTION_WEBHOOK_URL` to the publicly reachable API webhook endpoint. A connected WhatsApp instance does not prove that Evolution can deliver inbound messages; connection and webhook readiness are separate states. After changing a Production app variable or secret, republish so the running deployment receives the new value.

Bound every synchronous OpenAI request explicitly; the SDK's long default timeout and retries can exceed Heroku's 30-second webhook limit. Return a customer-facing recovery reply on model failure. For durable protection against timeouts and dyno restarts, acknowledge only after an atomic persisted inbox insert and process it with a recoverable database-backed worker; a fire-and-forget promise alone can lose acknowledged work.

**Why:** Retried booking messages can repeat side effects, while an LLM can return an incorrect service duration or stale availability. The user wants booking details retained across messages and a reservation completed as soon as the client chooses an offered time. Node may interpret a local date-time in UTC on the API host. Production logs also showed a WhatsApp webhook exceeding Heroku's 30-second limit and returning H12/503. The production webhook URL has no safe inferred fallback, so pairing can succeed while inbound messages never reach the app. Replit does not apply Production app variable changes to the active deployment until it is republished.

**How to apply:** Check persisted inbound message IDs and guard in-flight IDs at webhook entry. Make repeated identical bookings for the same client resolve to the existing appointment, and never trust a model-generated end time or availability claim as authoritative. Use the configured timezone for reminder comparisons, date display, and local agenda dates. Set explicit AI timeouts/retries and use a durable inbox/worker when the full workflow has multiple external calls. Verify webhook readiness separately from WhatsApp pairing, register it on explicit connect and fallback status paths, and surface configuration failures to the operator. After changing `EVOLUTION_WEBHOOK_URL` in Production, republish before checking delivery.

If processing succeeds but persisting the inbox completion fails, do not immediately mark the item pending: the appointment or reply may already have been committed. Leave the lease to expire, then recover the event through the normal worker path; provider-message deduplication must make replay safe. A failed initial inbox insert must return a non-success webhook response so Evolution retries.

**Why:** A PostgreSQL outage can occur after the handler has produced side effects but before the queue records completion. Immediate replay can duplicate work, while silently acknowledging a failed insert loses the webhook.

**How to apply:** Keep initial enqueue-before-ack semantics, distinguish handler failures from completion-write failures, use lease expiry for uncertain completion outcomes, and test both database failure and replay idempotency.

Production logs showed Evolution 400 responses for outbound messages to raw webhook identifiers beginning with the Portuguese country code 351 and to a 15-digit identifier. The current Brazilian phone normalizer prefixes 55 to every value that does not already begin with 55, which corrupts international numbers and cannot safely interpret WhatsApp LIDs.

**Why:** The logged failures affected both reactions and normal replies, including retries without quoted-message metadata; recipient addressing is therefore a concrete failure candidate, not just a quote-format problem.

**How to apply:** Preserve the provider's raw `remoteJid` when sending to webhook-originated conversations. Normalize Brazilian local numbers only when their country is known; do not infer Brazil for arbitrary international numbers or LIDs. Add tests for Brazilian, +351, and LID-shaped identifiers.

Production logs showed SPA state lock query timeouts and reminder lock-release failures with PostgreSQL session advisory locks. Use expiring database-row leases for SPA state writes and reminder coordination when Neon pooling may not preserve session affinity; validate lease ownership immediately before durable writes and reminder sends.

**Why:** Production spans many dynos, and a transaction-pooling connection can move a session-level advisory lock between backend sessions, causing timeouts or an apparent lost lock.

**How to apply:** Prefer a short atomic lease row with an owner token and expiry over session advisory locks for these cross-dyno critical sections. Renew long-held leases, check ownership before side effects, and ensure the additive lease-table migration is applied before deploying the new code.