---
name: Evolution QR connection flow
description: Provider behavior and connection UX for WhatsApp onboarding.
---

The onboarding flow should create an Evolution instance and present its returned QR Code instead of asking users to choose an existing instance. The connection state may remain `connecting` while the QR is waiting to be scanned.

Only one WhatsApp number should be active for this Spa at a time; connecting a new number replaces the previous active number rather than supporting parallel instances.

Validate provider QR responses as image data before presenting them: normalize supported base64 envelopes, check the decoded image signature, and let the browser report image decode failures. Surface a returned pairing code as an alternative and refresh connection state while the dialog is open. By default, avoid timer-driven calls to the connect endpoint because a new QR may invalidate the one currently being scanned. If automatic renewal is explicitly requested, refresh only while the dialog is open and the instance is pending, prevent overlapping requests, discard responses after the dialog closes, and stop after connection confirmation.

Diagnose connection failures by stage: config/instance lookup, provider create/connect response, local instance persistence, and webhook setup. Log only sanitized provider error details and QR/pairing-code presence flags; never log QR contents or pairing codes. A database or webhook failure after a provider response must not be mislabeled as the provider being unreachable.

**Why:** The account can contain several unrelated instances, so selecting from a shared list is ambiguous and does not match the intended operator workflow. Provider-controlled QR expiry cannot be lengthened by the app; renewal keeps a fresh code available but can rotate the code during a scan.

**How to apply:** Keep the provider API key server-side, create a generated instance name per connection, show only a valid image returned by `instance/create` or `instance/connect`, and treat `connecting` as a normal pending state rather than an error. Never log QR contents or pairing codes. A live QR test in development configures the dev webhook host; do not scan it with the production WhatsApp number.

**Why:** The user explicitly chose a single active Spa number, with a newly connected number replacing the previous one.

**Why:** A development-side live QR generation configured the newly created pending instance to send messages to the Replit development webhook, not the Heroku production webhook.