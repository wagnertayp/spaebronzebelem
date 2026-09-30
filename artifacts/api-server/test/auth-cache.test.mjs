import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import express from "express";
import { preventAuthenticationResponseCaching } from "../src/lib/auth-cache.ts";

test("session endpoint returns a body for conditional requests", async (t) => {
  const app = express();
  app.get("/auth/session", preventAuthenticationResponseCaching, (_req, res) => {
    res.json({ user: null });
  });

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/auth/session`;
  const firstResponse = await fetch(url);
  assert.equal(firstResponse.status, 200);
  const etag = firstResponse.headers.get("etag");
  assert.ok(etag);
  assert.match(firstResponse.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await firstResponse.json(), { user: null });

  const conditionalResponse = await fetch(url, {
    headers: { "If-None-Match": etag },
  });
  assert.equal(conditionalResponse.status, 200);
  assert.match(conditionalResponse.headers.get("cache-control") ?? "", /no-store/);
  assert.deepEqual(await conditionalResponse.json(), { user: null });
});