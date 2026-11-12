import assert from "node:assert/strict";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { pairingCodeFromResponse, qrCodeFromResponse } from "../src/lib/evolution-qr.ts";

const tinyPng =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/vqkAAAAASUVORK5CYII=";

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, typeBytes, data, checksum]);
};

const createPng = (width, height) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rowLength = 1 + width * 3;
  const pixels = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) * 255;
      const offset = y * rowLength + 1 + x * 3;
      pixels.fill(color, offset, offset + 3);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
};

const scanReadyPng = createPng(160, 160);

test("normalizes a scan-sized provider PNG into a browser-ready data URI", () => {
  assert.equal(
    qrCodeFromResponse({ qrcode: { base64: scanReadyPng } }),
    `data:image/png;base64,${scanReadyPng}`,
  );
});

test("accepts a provider data URI and top-level QR fields", () => {
  assert.equal(
    qrCodeFromResponse({ base64Image: `data:image/png;base64,${scanReadyPng}` }),
    `data:image/png;base64,${scanReadyPng}`,
  );
});

test("accepts QR images returned as strings or inside the provider data envelope", () => {
  assert.equal(
    qrCodeFromResponse({ qrcode: `data:image/png;base64,${scanReadyPng}` }),
    `data:image/png;base64,${scanReadyPng}`,
  );
  assert.equal(
    qrCodeFromResponse({ data: { base64: scanReadyPng } }),
    `data:image/png;base64,${scanReadyPng}`,
  );
  assert.equal(
    qrCodeFromResponse({ data: { qrcode: { base64: scanReadyPng } } }),
    `data:image/png;base64,${scanReadyPng}`,
  );
});

test("rejects malformed, non-image, and too-small QR payloads", () => {
  assert.equal(qrCodeFromResponse({ qrcode: { base64: "not-an-image" } }), null);
  assert.equal(qrCodeFromResponse({ qrcode: { base64: "data:image/png;base64,???" } }), null);
  assert.equal(qrCodeFromResponse({ qrcode: { code: "whatsapp-pairing-payload" } }), null);
  assert.equal(qrCodeFromResponse({ qrcode: { base64: tinyPng } }), null);
});

test("reads the pairing code from either supported response envelope", () => {
  assert.equal(pairingCodeFromResponse({ qrcode: { pairingCode: " 1234-ABCD " } }), "1234-ABCD");
  assert.equal(pairingCodeFromResponse({ pairingCode: "5678-EFGH" }), "5678-EFGH");
});