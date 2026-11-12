import { Buffer } from "node:buffer";

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;

const imageMimeFromBytes = (bytes: Buffer): string | null => {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";
  if (
    bytes.length >= 6 &&
    ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))
  ) return "image/gif";
  return null;
};

const imageDimensionsFromBytes = (
  bytes: Buffer,
  mime: string,
): { width: number; height: number } | null => {
  if (mime === "image/png" && bytes.length >= 24) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (mime === "image/gif" && bytes.length >= 10) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  if (mime === "image/webp" && bytes.length >= 30) {
    const format = bytes.toString("ascii", 12, 16);
    if (format === "VP8X") {
      return {
        width: 1 + bytes.readUIntLE(24, 3),
        height: 1 + bytes.readUIntLE(27, 3),
      };
    }
    if (
      format === "VP8 " &&
      bytes[23] === 0x9d &&
      bytes[24] === 0x01 &&
      bytes[25] === 0x2a
    ) {
      return {
        width: bytes.readUInt16LE(26) & 0x3fff,
        height: bytes.readUInt16LE(28) & 0x3fff,
      };
    }
    if (format === "VP8L" && bytes[20] === 0x2f) {
      return {
        width: 1 + (bytes[21]! | ((bytes[22]! & 0x3f) << 8)),
        height: 1 + ((bytes[22]! >> 6) | (bytes[23]! << 2) | ((bytes[24]! & 0x0f) << 10)),
      };
    }
  }
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      while (bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (offset + 2 > bytes.length) break;
      const segmentLength = bytes.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isStartOfFrame && segmentLength >= 7) {
        return {
          height: bytes.readUInt16BE(offset + 3),
          width: bytes.readUInt16BE(offset + 5),
        };
      }
      offset += segmentLength;
    }
  }
  return null;
};

const getBase64Image = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  const dataUri = /^data:image\/(?:png|jpe?g|webp|gif);base64,([\s\S]+)$/i.exec(trimmed);
  const rawBase64 = (dataUri?.[1] ?? trimmed).replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(rawBase64)) return null;

  const normalized = rawBase64.replace(/-/g, "+").replace(/_/g, "/");
  const unpadded = normalized.replace(/=+$/, "");
  if (unpadded.length % 4 === 1) return null;

  const bytes = Buffer.from(normalized, "base64");
  if (
    bytes.length < 16 ||
    bytes.toString("base64").replace(/=+$/, "") !== unpadded
  ) return null;

  const mime = imageMimeFromBytes(bytes);
  if (!mime) return null;
  const dimensions = imageDimensionsFromBytes(bytes, mime);
  if (!dimensions || dimensions.width < 128 || dimensions.height < 128) return null;
  return `data:${mime};base64,${bytes.toString("base64")}`;
};

export const qrCodeFromResponse = (body: JsonRecord): string | null => {
  const qr = asRecord(body.qrcode) ?? asRecord(body.qrCode);
  const data = asRecord(body.data);
  const nestedQr = asRecord(data?.qrcode) ?? asRecord(data?.qrCode);
  const candidates = [
    qr?.base64,
    qr?.base64Image,
    qr?.image,
    qr?.qrCode,
    nestedQr?.base64,
    nestedQr?.base64Image,
    nestedQr?.image,
    nestedQr?.qrCode,
    body.base64,
    body.base64Image,
    data?.base64,
    data?.base64Image,
    typeof body.qrCode === "string" ? body.qrCode : null,
    typeof body.qrcode === "string" ? body.qrcode : null,
    typeof data?.qrCode === "string" ? data.qrCode : null,
    typeof data?.qrcode === "string" ? data.qrcode : null,
  ];

  for (const candidate of candidates) {
    const image = getBase64Image(candidate);
    if (image) return image;
  }
  return null;
};

export const pairingCodeFromResponse = (body: JsonRecord): string | null => {
  const qr = asRecord(body.qrcode) ?? asRecord(body.qrCode);
  const data = asRecord(body.data);
  const nestedQr = asRecord(data?.qrcode) ?? asRecord(data?.qrCode);
  const value = qr?.pairingCode ?? nestedQr?.pairingCode ?? body.pairingCode ?? data?.pairingCode;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};