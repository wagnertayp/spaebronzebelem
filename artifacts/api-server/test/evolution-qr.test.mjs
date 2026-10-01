import assert from "node:assert/strict";
import test from "node:test";
import { pairingCodeFromResponse, qrCodeFromResponse } from "../src/lib/evolution-qr.ts";

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vqkAAAAASUVORK5CYII=";

test("normalizes a valid provider PNG into a browser-ready data URI", () => {
  assert.equal(
    qrCodeFromResponse({ qrcode: { base64: tinyPng } }),
    `data:image/png;base64,${tinyPng}`,
  );
});

test("accepts a provider data URI and top-level QR fields", () => {
  assert.equal(
    qrCodeFromResponse({ base64Image: `data:image/png;base64,${tinyPng}` }),
    `data:image/png;base64,${tinyPng}`,
  );
});

test("rejects malformed base64 and non-image QR payloads", () => {
  assert.equal(qrCodeFromResponse({ qrcode: { base64: "not-an-image" } }), null);
  assert.equal(qrCodeFromResponse({ qrcode: { base64: "data:image/png;base64,???" } }), null);
  assert.equal(qrCodeFromResponse({ qrcode: { code: "whatsapp-pairing-payload" } }), null);
});

test("reads the pairing code from either supported response envelope", () => {
  assert.equal(pairingCodeFromResponse({ qrcode: { pairingCode: " 1234-ABCD " } }), "1234-ABCD");
  assert.equal(pairingCodeFromResponse({ pairingCode: "5678-EFGH" }), "5678-EFGH");
});