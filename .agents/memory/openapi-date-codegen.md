---
name: OpenAPI date codegen
description: Avoiding mismatched date types between generated API clients and server validators.
---

When the browser API client must send a date as a string, do not assume `format: date` produces the same TypeScript type in every generated package. In this workspace, Orval generated a `Date` for the server's Zod type but a `string` for the React client. Keep the OpenAPI field as `type: string` and validate the date string explicitly in the server when both sides need the same representation.

**Why:** A professional schedule exception date compiled as `Date` in the API server and `string` in the client, breaking server typechecking and equality checks.

**How to apply:** Before adding OpenAPI date formats, inspect both generated Zod and React types; if their representations differ, remove the format and validate the string shape and calendar date at the API boundary.