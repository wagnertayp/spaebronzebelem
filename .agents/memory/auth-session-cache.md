---
name: Auth session caching
description: Prevent conditional HTTP caching from clearing the SPA's authentication state on reload.
---

Keep browser caching disabled for auth responses and explicitly request the current session with `cache: "no-store"`. Also strip `If-None-Match` and `If-Modified-Since` before auth handlers; Express can return 304 for a conditional request despite `Cache-Control: no-store`. The auth guard must also remain in its loading state until the validated session user has been copied into auth state, and `/login` should redirect users who are already authenticated.

**Why:** A production request to the session endpoint with its previous ETag returned a bodyless 304, causing the client to lose the user state even though the session cookie could still be valid. A separate production trace returned a valid admin session, but the guard could redirect during the render before the session-sync effect updated `user`; the unguarded login route then stayed visible.

**How to apply:** Preserve `no-store` response headers on authentication endpoints, use `cache: "no-store"` on session rehydration, ignore conditional validators so every auth response has a body, and gate redirects on completed session hydration. Do not try to solve these client-state issues by extending the cookie TTL.