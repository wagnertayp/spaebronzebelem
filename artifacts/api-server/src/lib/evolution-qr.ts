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
  return mime ? `data:${mime};base64,${bytes.toString("base64")}` : null;
};

export const qrCodeFromResponse = (body: JsonRecord): string | null => {
  const qr = asRecord(body.qrcode) ?? asRecord(body.qrCode);
  const candidates = [
    qr?.base64,
    qr?.base64Image,
    qr?.image,
    qr?.qrCode,
    body.base64,
    body.base64Image,
    typeof body.qrCode === "string" ? body.qrCode : null,
  ];

  for (const candidate of candidates) {
    const image = getBase64Image(candidate);
    if (image) return image;
  }
  return null;
};

export const pairingCodeFromResponse = (body: JsonRecord): string | null => {
  const qr = asRecord(body.qrcode) ?? asRecord(body.qrCode);
  const value = qr?.pairingCode ?? body.pairingCode;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};