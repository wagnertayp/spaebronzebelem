---
name: WhatsApp unanswered-message scope
description: User-approved boundary for monitoring messages that have no successful response.
---

Only incoming messages already saved in the app may appear in the unanswered queue. Do not scan Evolution history or arbitrary provider instances, and do not send automatic replies.

**Why:** The user chose app-saved-only detection and wants operators to reply manually to avoid duplicate responses.

**How to apply:** Keep the checker based on persisted app messages. Messages never saved because a webhook was missed are outside this feature's detection scope.

When activating or reactivating WhatsApp processing after a pause, process only inbound events received from the activation point forward. A new inbound message after activation is eligible even in an existing conversation. Never drain an older pending/unanswered backlog or send catch-up replies to conversations already handled by staff or left unanswered.

**Why:** The user explicitly requires replies to begin only once the agent is active; new messages after activation are allowed, but old queued events must not be processed or sent later.

**How to apply:** Establish a durable activation cutoff or otherwise isolate pre-activation jobs before starting the worker. Ensure older pending rows cannot block newer messages from the same contact, then test with a fresh inbound message after activation.