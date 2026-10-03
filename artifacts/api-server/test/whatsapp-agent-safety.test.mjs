import assert from "node:assert/strict";
import test from "node:test";
import {
  clientOnTheWayReply,
  isClientOnTheWay,
  isTanningService,
  mentionsPregnancy,
  mentionsSpaInfantil,
  pregnancyTanningRefusal,
  spaInfantilHandoffReply,
} from "../src/lib/whatsapp-agent-safety.ts";
import {
  bronzeAudioUnavailableReply,
  bronzeMethodDifferenceReply,
  shouldSendBronzeAudio,
} from "../src/lib/whatsapp-bronze.ts";

test("detects common pregnancy terms without accent sensitivity", () => {
  assert.equal(mentionsPregnancy("Estou grávida"), true);
  assert.equal(mentionsPregnancy("sou gestante"), true);
  assert.equal(mentionsPregnancy("dúvida sobre gravidez"), true);
  assert.equal(mentionsPregnancy("quero fazer uma massagem"), false);
});

test("recognizes on-the-way updates and avoids booking questions", () => {
  assert.equal(isClientOnTheWay("Estou a caminho"), true);
  assert.equal(isClientOnTheWay("Tô chegando agora"), true);
  assert.equal(isClientOnTheWay("Já cheguei ao spa"), true);
  assert.equal(isClientOnTheWay("Não estou a caminho"), false);
  assert.equal(isClientOnTheWay("Qual caminho devo fazer?"), false);
  assert.match(clientOnTheWayReply, /estamos te aguardando/i);
  assert.doesNotMatch(clientOnTheWayReply, /agendar|qual serviço/i);
});

test("identifies tanning services and rejects the booking safely", () => {
  assert.equal(isTanningService("Bronzeamento em máquina"), true);
  assert.equal(isTanningService("Marquinha natural"), true);
  assert.equal(isTanningService("Sessão premium", "Bronzeamento"), true);
  assert.equal(isTanningService("Massagem relaxante"), false);
  assert.match(pregnancyTanningRefusal, /não realizamos bronzeamento durante a gravidez/i);
});

test("recognizes Spa Infantil questions, including the common spelling in chat", () => {
  assert.equal(mentionsSpaInfantil("Ainda tem o spar infantil?"), true);
  assert.equal(mentionsSpaInfantil("Vocês têm Spa Infantil?"), true);
  assert.equal(mentionsSpaInfantil("Tem spa para crianças?"), true);
  assert.equal(mentionsSpaInfantil("Quero falar com uma atendente"), false);
  assert.match(spaInfantilHandoffReply, /banho à base de hidratante e açúcar/i);
  assert.match(spaInfantilHandoffReply, /sem chumbo ou amônia/i);
  assert.match(spaInfantilHandoffReply, /crianças de 2 a 10 anos/i);
  assert.match(spaInfantilHandoffReply, /encaminhar você para uma atendente/i);
  assert.doesNotMatch(spaInfantilHandoffReply, /sem química/i);
});

test("attempts the bronze clip only once and follows with method and Neon details", () => {
  assert.equal(shouldSendBronzeAudio(true, false), true);
  assert.equal(shouldSendBronzeAudio(true, true), false);
  assert.equal(shouldSendBronzeAudio(false, false), false);
  assert.equal(shouldSendBronzeAudio(true, false, true), false);
  assert.match(bronzeMethodDifferenceReply, /exposição ao sol/i);
  assert.match(bronzeMethodDifferenceReply, /WB Ultra/i);
  assert.match(bronzeMethodDifferenceReply, /72 lâmpadas/i);
  assert.match(bronzeMethodDifferenceReply, /8 a 20 minutos/i);
  assert.doesNotMatch(bronzeMethodDifferenceReply, /Protocolo Neon/i);
  assert.match(bronzeAudioUnavailableReply, /Não consegui enviar o áudio agora/i);
  assert.doesNotMatch(bronzeAudioUnavailableReply, /Protocolo Neon/i);
});