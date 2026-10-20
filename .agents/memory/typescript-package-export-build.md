---
name: TypeScript package export builds
description: Building declarations for new subpath exports in this pnpm TypeScript workspace.
---

When a dependent project imports a newly added subpath from a composite workspace package, its declaration output must exist before the dependent project's typecheck can resolve it. Run the declaration build from the package directory so pnpm resolves that package's own type dependencies.

**Why:** The API typecheck reported TS6305 for a new managed-client subpath, while a root-level one-file compiler invocation could not resolve the package's Node type definitions.

**How to apply:** For new exports in composite workspace packages, build their declarations in package context, then run the downstream project's typecheck.
