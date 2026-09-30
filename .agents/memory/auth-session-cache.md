---
name: Auth session caching
description: Prevent conditional HTTP caching from clearing the SPA's authentication state on reload.
---

Keep browser caching disabled for auth responses and explicitly request the current session with `cache: "no-store"`. The API client treats HTTP 304 responses as bodyless, while the auth provider treats missing session data as signed out.

**Why:** A page refresh produced a conditional 304 for the session endpoint, causing the client to lose the user state even though the session cookie could still be valid.

**How to apply:** Preserve `no-store` response headers on authentication endpoints and `cache: "no-store"` on session rehydration. Do not try to solve this by extending the cookie TTL.