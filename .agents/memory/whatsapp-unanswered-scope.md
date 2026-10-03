---
name: WhatsApp unanswered-message scope
description: User-approved boundary for monitoring messages that have no successful response.
---

Only incoming messages already saved in the app may appear in the unanswered queue. Do not scan Evolution history or arbitrary provider instances, and do not send automatic replies.

**Why:** The user chose app-saved-only detection and wants operators to reply manually to avoid duplicate responses.

**How to apply:** Keep the checker based on persisted app messages. Messages never saved because a webhook was missed are outside this feature's detection scope.