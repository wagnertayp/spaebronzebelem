---
name: WhatsApp webhook idempotency
description: Prevent duplicate Evolution webhook deliveries from repeating AI and scheduling side effects.
---

Deduplicate inbound Evolution events by provider message ID before transcription, AI processing, or appointment creation. Appointment conflicts must still be checked against the current agenda when committing a booking; prompt context alone cannot guarantee availability.

**Why:** A retried booking message can create an appointment once, then run again against the newly occupied slot and tell the same client that the time is unavailable.

**How to apply:** Check persisted inbound message IDs and guard in-flight IDs at webhook entry. Make repeated identical bookings for the same client resolve to the existing appointment rather than a conflict.