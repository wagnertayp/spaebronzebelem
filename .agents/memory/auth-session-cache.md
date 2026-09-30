---
name: Auth session caching
description: Prevent conditional HTTP caching from clearing the SPA's authentication state on reload.
---

Keep browser caching disabled for auth responses and explicitly request the current session with `cache: "no-store"`. Also strip `If-None-Match` and `If-Modified-Since` before auth handlers; Express can return 304 for a conditional request despite `Cache-Control: no-store`.

**Why:** A production request to the session endpoint with its previous ETag returned a bodyless 304, causing the client to lose the user state even though the session cookie could still be valid.

**How to apply:** Preserve `no-store` response headers on authentication endpoints, use `cache: "no-store"` on session rehydration, and ignore conditional validators so every auth response has a body. Do not try to solve this by extending the cookie TTL.