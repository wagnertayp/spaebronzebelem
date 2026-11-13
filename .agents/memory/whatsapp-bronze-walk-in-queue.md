---
name: WhatsApp bronze walk-in queue
description: When confirmed WhatsApp tanning clients should be added to the dedicated attendance queue.
---

When a client confirms that she intends to come for bronze, add her to the dedicated walk-in attendance queue even though bronze is not an appointment. Recognize short confirmations in context, such as “vou sim,” rather than only messages that repeat the word bronze. Keep the pregnancy safety gate: do not enqueue until she has clearly denied pregnancy; a positive or uncertain answer must not be treated as clearance. Avoid duplicate active entries for the same client on the same local day.

The queue is for same-day arrivals, not future visits. If the client says she will come tomorrow, preserve that date, do not add her to today's queue, and ask her to message when she arrives tomorrow.

**Why:** The user explicitly said a client who confirms she will come for bronze must appear in the attendance queue even though the service is walk-in.

**Why:** The user showed a client saying she would visit tomorrow being added to today's queue and explicitly asked to correct that logic.

**How to apply:** Interpret the confirmation using the full current atendimento history and previous assistant question, then enqueue through the operational-state lock so the entry persists and appears in the dedicated attendance queue.

**How to apply:** Check the stated visit day before enqueueing. A future-day confirmation must never create an entry dated from the message-processing timestamp.
