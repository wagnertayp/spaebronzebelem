---
name: WhatsApp AI cost control
description: The user's cost concern and constraint for reducing WhatsApp agent AI usage.
---

The user considers the WhatsApp AI agent's current cost high and wants to reduce it. Measure per-call token usage and consult actual Replit Usage totals before quoting a project-wide spend. Preserve all messages within an active atendimento window; start a new window after more than 24 hours without messages. Historical messages remain stored, but are not sent as current context after that gap. Changing to a cheaper model can affect answer quality and requires explicit approval.

**Why:** The user asked how token billing works, how much the app is costing, and whether cost can be lowered.

The user is comfortable spending tokens for pregnancy guidance and other sensitive or nuanced atendimento topics. Do not reduce context or quality in those cases to save tokens.

**How to apply:** Log model and input/output token counts without conversation text or credentials, separate successful calls from failures, and prefer prompt-efficiency or provider-supported caching before reducing context within the active 24-hour attendance window or changing models.
