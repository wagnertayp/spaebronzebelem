import { randomUUID } from "node:crypto";

export type WhatsappWebhookPayload = Record<string, unknown>;

export const combineWhatsappInboundMessages = (messages: string[]) => {
  const cleanedMessages = messages.map((message) => message.trim()).filter(Boolean);
  if (cleanedMessages.length < 2) return cleanedMessages[0] ?? "";
  return cleanedMessages.map((message, index) => `${index + 1}. ${message}`).join("\n");
};

export const makeWhatsappWebhookEventKey = (
  payload: WhatsappWebhookPayload,
): string => {
  const data = (payload["data"] as Record<string, unknown> | undefined) ?? payload;
  const key = (data["key"] as Record<string, unknown> | undefined) ?? {};
  const phone = String(key["remoteJid"] ?? "").split("@")[0].replace(/\D/g, "");
  const providerMessageId = typeof key["id"] === "string" ? key["id"].trim() : "";
  const instance = typeof payload["instance"] === "string"
    ? payload["instance"].trim()
    : "default";

  if (providerMessageId) {
    return `${instance}:${phone}:${providerMessageId}`;
  }

  return `${instance}:unkeyed:${randomUUID()}`;
};

export const stripInlineMedia = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripInlineMedia);
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && value.length > 256_000) {
      return "[large inline content omitted]";
    }
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.toLocaleLowerCase("en-US") !== "base64")
      .map(([key, child]) => [key, stripInlineMedia(child)]),
  );
};

export const webhookRetryDelaySeconds = (attempts: number) =>
  Math.min(300, 2 ** Math.min(Math.max(1, Math.floor(attempts)), 9));