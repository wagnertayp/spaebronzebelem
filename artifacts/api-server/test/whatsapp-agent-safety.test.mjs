import assert from "node:assert/strict";
import test from "node:test";
import {
  isTanningService,
  mentionsPregnancy,
  pregnancyTanningRefusal,
} from "../src/lib/whatsapp-agent-safety.ts";

test("detects common pregnancy terms without accent sensitivity", () => {
  assert.equal(mentionsPregnancy("Estou grávida"), true);
  assert.equal(mentionsPregnancy("sou gestante"), true);
  assert.equal(mentionsPregnancy("dúvida sobre gravidez"), true);
  assert.equal(mentionsPregnancy("quero fazer uma massagem"), false);
});

test("identifies tanning services and rejects the booking safely", () => {
  assert.equal(isTanningService("Bronzeamento em máquina"), true);
  assert.equal(isTanningService("Marquinha natural"), true);
  assert.equal(isTanningService("Sessão premium", "Bronzeamento"), true);
  assert.equal(isTanningService("Massagem relaxante"), false);
  assert.match(pregnancyTanningRefusal, /não realizamos bronzeamento durante a gravidez/i);
});