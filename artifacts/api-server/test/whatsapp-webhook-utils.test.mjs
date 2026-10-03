import assert from "node:assert/strict";
import test from "node:test";
import {
  combineWhatsappInboundMessages,
  makeWhatsappWebhookEventKey,
  stripInlineMedia,
  webhookRetryDelaySeconds,
} from "../src/lib/whatsapp-webhook-utils.ts";

test("combines consecutive client messages in their original order", () => {
  assert.equal(
    combineWhatsappInboundMessages([" Estou com 17 semanas ainda ", "Estou doida pra fazer essa", "Mas vou aguardar"]),
    "1. Estou com 17 semanas ainda\n2. Estou doida pra fazer essa\n3. Mas vou aguardar",
  );
  assert.equal(combineWhatsappInboundMessages(["Bom dia"]), "Bom dia");
  assert.equal(combineWhatsappInboundMessages(["  ", ""]), "");
});

test("webhook event keys are stable for provider message IDs", () => {
  const event = {
    instance: "spa-instance",
    data: {
      key: {
        remoteJid: "5591999999999@s.whatsapp.net",
        id: "provider-message-1",
      },
    },
  };

  assert.equal(
    makeWhatsappWebhookEventKey(event),
    "spa-instance:5591999999999:provider-message-1",
  );
  assert.equal(makeWhatsappWebhookEventKey(event), makeWhatsappWebhookEventKey(event));
});

test("webhook payload sanitization removes inline media recursively", () => {
  const safe = stripInlineMedia({
    data: {
      message: {
        imageMessage: {
          mimetype: "image/jpeg",
          base64: "encoded-image",
        },
        nested: [{ base64: "encoded-audio", caption: "hello" }],
      },
    },
  });

  assert.deepEqual(safe, {
    data: {
      message: {
        imageMessage: { mimetype: "image/jpeg" },
        nested: [{ caption: "hello" }],
      },
    },
  });
});

test("webhook retries back off and remain capped", () => {
  assert.equal(webhookRetryDelaySeconds(1), 2);
  assert.equal(webhookRetryDelaySeconds(4), 16);
  assert.equal(webhookRetryDelaySeconds(9), 300);
  assert.equal(webhookRetryDelaySeconds(50), 300);
});