---
name: WhatsApp booking intent boundaries
description: Distinguish catalog browsing and new topics from explicit booking intent.
---

Do not turn catalog browsing, a request to learn about procedures, or a clear change of subject into an appointment attempt. A short “ok” after the agent offers or sends a catalog accepts the catalog, not a booking. Only start or continue booking for a specific bookable service when the current turn explicitly asks to schedule or is answering the immediately active booking flow. Clear a stale unfinished booking draft when the client explicitly changes to a non-booking topic.

**Why:** The user showed a conversation where the client asked for the advanced-aesthetics catalog and the agent incorrectly offered a Ritual Facial appointment based on earlier context.

**How to apply:** Treat the current message and the immediately preceding assistant prompt as the authority for intent. Never infer booking consent from old booking history or a generic affirmative after a catalog offer; validate any scheduled service against the active catalog and its configured duration.
