import assert from "node:assert/strict";
import test from "node:test";
import { sendTextWithQuoteFallback } from "../src/lib/evolution-text-fallback.ts";

test("retries a rejected quoted text reply without a quote", async () => {
  const requests = [];
  const response = await sendTextWithQuoteFallback(async (includeQuote) => {
    requests.push(includeQuote);
    return includeQuote
      ? { ok: false, status: 400 }
      : { ok: true, status: 200 };
  }, true);

  assert.deepEqual(requests, [true, false]);
  assert.equal(response.ok, true);
});

test("does not retry ordinary text failures or unquoted requests", async () => {
  let attempts = 0;
  await sendTextWithQuoteFallback(async () => {
    attempts += 1;
    return { ok: false, status: 503 };
  }, true);
  assert.equal(attempts, 1);

  await sendTextWithQuoteFallback(async () => {
    attempts += 1;
    return { ok: false, status: 400 };
  }, false);
  assert.equal(attempts, 2);
});
