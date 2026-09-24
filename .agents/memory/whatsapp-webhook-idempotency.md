---
name: WhatsApp webhook idempotency
description: Prevent duplicate Evolution webhook deliveries from repeating AI and scheduling side effects.
---

Deduplicate inbound Evolution events by provider message ID before transcription, AI processing, or appointment creation. Treat AI appointment fields as a proposal: validate service, professional, and local start time against current data, then calculate the end from the catalog duration on the server. Check conflicts against the current agenda when committing; prompt context alone cannot guarantee availability. Parse timezone-naive appointment date-times in the configured agenda timezone, not the server's default timezone, when formatting or evaluating reminder windows.

**Why:** A retried booking message can repeat side effects, while an LLM can return an incorrect service duration or stale availability. The server must own the committed appointment interval. Node may interpret a local date-time in UTC on the API host, shifting reminder thresholds by several hours.

**How to apply:** Check persisted inbound message IDs and guard in-flight IDs at webhook entry. Make repeated identical bookings for the same client resolve to the existing appointment, and never trust a model-generated end time or availability claim as authoritative. Use the configured timezone for reminder comparisons, date display, and local agenda dates.