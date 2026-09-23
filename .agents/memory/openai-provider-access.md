---
name: OpenAI provider access
description: Replit-managed OpenAI integration behavior when provider access is restricted.
---

The Replit-managed OpenAI integration may return HTTP 401 even when the SDK is configured and the model is supported if the account is restricted; provisioning then reports the account restriction explicitly.

**Why:** A real WhatsApp webhook reached the model call successfully, but the provider rejected authentication before generating a response.

**How to apply:** Treat this as an environment/account access issue, not an application prompt or webhook issue. Log the provider error, avoid sending a misleading generic handoff, and retest after the account restriction is resolved.