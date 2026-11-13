import assert from "node:assert/strict";
import test from "node:test";
import {
  isWhatsappCustomerAnswerKind,
  isWhatsappReplyAfterInbound,
} from "../src/lib/whatsapp-reply-idempotency.ts";

const inbound = {
  id: 20,
  createdAt: new Date("2026-11-13T10:00:00.000Z"),
};

test("does not treat an identical reply from an older turn as this turn's reply", () => {
  assert.equal(isWhatsappReplyAfterInbound(inbound, {
    id: 19,
    createdAt: new Date("2026-11-13T09:59:59.999Z"),
  }), false);
});

test("matches a reply created after the current inbound message", () => {
  assert.equal(isWhatsappReplyAfterInbound(inbound, {
    id: 21,
    createdAt: new Date("2026-11-13T10:00:00.001Z"),
  }), true);
});

test("uses row order to distinguish messages created in the same millisecond", () => {
  assert.equal(isWhatsappReplyAfterInbound(inbound, {
    id: 19,
    createdAt: new Date("2026-11-13T10:00:00.000Z"),
  }), false);
  assert.equal(isWhatsappReplyAfterInbound(inbound, {
    id: 21,
    createdAt: new Date("2026-11-13T10:00:00.000Z"),
  }), true);
});

test("only customer-facing reply and handoff text closes unanswered inbound messages", () => {
  assert.equal(isWhatsappCustomerAnswerKind("reply"), true);
  assert.equal(isWhatsappCustomerAnswerKind("handoff"), true);
  assert.equal(isWhatsappCustomerAnswerKind("document"), false);
  assert.equal(isWhatsappCustomerAnswerKind("image"), false);
  assert.equal(isWhatsappCustomerAnswerKind("audio"), false);
  assert.equal(isWhatsappCustomerAnswerKind("reminder24h"), false);
});
