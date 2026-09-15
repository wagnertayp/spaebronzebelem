---
name: Evolution QR connection flow
description: Provider behavior and connection UX for WhatsApp onboarding.
---

The onboarding flow should create an Evolution instance and present its returned QR Code instead of asking users to choose an existing instance. The connection state may remain `connecting` while the QR is waiting to be scanned.

**Why:** The account can contain several unrelated instances, so selecting from a shared list is ambiguous and does not match the intended operator workflow.

**How to apply:** Keep the provider API key server-side, create a generated instance name per connection, show the QR returned by `instance/create`, and treat `connecting` as a normal pending state rather than an error.