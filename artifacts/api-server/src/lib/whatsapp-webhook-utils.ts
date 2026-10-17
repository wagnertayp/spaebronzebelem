import { randomUUID } from "node:crypto";

export type WhatsappWebhookPayload = Record<string, unknown>;
const MAX_QUEUED_AUDIO_BASE64_CHARS = 8_000_000;

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

export const stripInlineMedia = (
  value: unknown,
  insideAudioMessage = false,
  preserveAudioBase64 = true,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripInlineMedia(item, insideAudioMessage, preserveAudioBase64));
  }
  if (!value || typeof value !== "object") {
    if (
      typeof value === "string" &&
      value.length > 256_000 &&
      !(insideAudioMessage && preserveAudioBase64 && value.length <= MAX_QUEUED_AUDIO_BASE64_CHARS)
    ) {
      return "[large inline content omitted]";
    }
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, child]) => {
        if (key.toLocaleLowerCase("en-US") !== "base64") return true;
        return preserveAudioBase64 &&
          insideAudioMessage &&
          typeof child === "string" &&
          child.length <= MAX_QUEUED_AUDIO_BASE64_CHARS;
      })
      .map(([key, child]) => [
        key,
        stripInlineMedia(
          child,
          insideAudioMessage ||
            ["audiomessage", "pttmessage"].includes(key.toLocaleLowerCase("en-US")),
          preserveAudioBase64,
        ),
      ]),
  );
};

export const webhookRetryDelaySeconds = (attempts: number) =>
  Math.min(300, 2 ** Math.min(Math.max(1, Math.floor(attempts)), 9));