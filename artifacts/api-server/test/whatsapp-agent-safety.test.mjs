import assert from "node:assert/strict";
import test from "node:test";
import {
  clientArrivalEtaReply,
  clientOnTheWayReply,
  dapServiceInformationReply,
  bathMoonBannerInformationReply,
  getWhatsappBathMoonBannerSelection,
  isBathMoonServiceRequest,
  getWhatsappArrivalUpdate,
  getWhatsappTanningFlow,
  isExplicitWhatsappBronzeInfoRequest,
  isWhatsappTanningVisitIntent,
  isWhatsappAcceptanceOfServiceOffer,
  isWhatsappDecisionDeferral,
  isDapServiceRequest,
  isSpaBathServiceRequest,
  isClientOnTheWay,
  isWhatsappWalkInService,
  isTanningService,
  mentionsPregnancy,
  mentionsSpaInfantil,
  removeWhatsappProfessionalNames,
  pregnancyTanningRefusal,
  spaInfantilHandoffReply,
  spaBathServiceInformationReply,
  whatsappDecisionDeferralReply,
} from "../src/lib/whatsapp-agent-safety.ts";
import {
  bronzeNeonRecommendationReply,
  bronzeAudioUnavailableReply,
  bronzeMethodDifferenceReply,
  resolveRequestedWhatsappAudioClip,
  shouldAskWhatsappBronzeMethod,
  shouldSuggestWhatsappNeon,
  shouldSendBronzeAudio,
  shouldSendWhatsappAudioClip,
} from "../src/lib/whatsapp-bronze.ts";

test("detects common pregnancy terms without accent sensitivity", () => {
  assert.equal(mentionsPregnancy("Estou grávida"), true);
  assert.equal(mentionsPregnancy("sou gestante"), true);
  assert.equal(mentionsPregnancy("dúvida sobre gravidez"), true);
  assert.equal(mentionsPregnancy("quero fazer uma massagem"), false);
});

test("recognizes on-the-way updates and avoids booking questions", () => {
  assert.equal(isClientOnTheWay("Estou a caminho"), true);
  assert.equal(isClientOnTheWay("Vamos de Uber"), true);
  assert.equal(isClientOnTheWay("Dá para ir de Uber?"), false);
  assert.equal(isClientOnTheWay("Tô chegando agora"), true);
  assert.equal(isClientOnTheWay("Já cheguei ao spa"), true);
  assert.equal(getWhatsappArrivalUpdate("Cheguei"), "arrived");
  assert.equal(getWhatsappArrivalUpdate("Acho que vou conseguir chegar só às 14:00"), "eta");
  assert.match(clientArrivalEtaReply, /equipe fica ciente/i);
  assert.equal(isClientOnTheWay("Não estou a caminho"), false);
  assert.equal(isClientOnTheWay("Ainda não cheguei"), false);
  assert.equal(isClientOnTheWay("Qual caminho devo fazer?"), false);
  assert.match(clientOnTheWayReply, /estamos te aguardando/i);
  assert.match(clientOnTheWayReply, /recepção/i);
  assert.doesNotMatch(clientOnTheWayReply, /agendar|qual serviço/i);
});

test("acknowledges a pause while the client checks a booking without repeating slot choices", () => {
  assert.equal(isWhatsappDecisionDeferral("Um momento irei ver que vou com minha amiga"), true);
  assert.equal(isWhatsappDecisionDeferral("Vou confirmar com minha amiga"), true);
  assert.equal(isWhatsappDecisionDeferral("Prefiro 15h30"), false);
  assert.match(whatsappDecisionDeferralReply, /sem pressa/i);
  assert.match(whatsappDecisionDeferralReply, /confiro novamente os horários/i);
});

test("continues an accepted offer to show other services instead of asking again", () => {
  assert.equal(
    isWhatsappAcceptanceOfServiceOffer(
      "Eu quero",
      "Vou te ajudar com carinho. Você quer conhecer quais outros serviços temos para gestante?",
    ),
    true,
  );
  assert.equal(
    isWhatsappAcceptanceOfServiceOffer(
      "Qual o valor?",
      "Se quiser, posso te passar outras opções de cuidados do Spa.",
    ),
    false,
  );
});

test("recognizes DAP as a walk-in service and gives only the supplied details", () => {
  assert.equal(isDapServiceRequest("Vocês fazem D.A.P.?"), true);
  assert.equal(isDapServiceRequest("Drenagem de Alta Performance"), true);
  assert.equal(isWhatsappWalkInService("DAP"), true);
  assert.equal(isWhatsappWalkInService("Drenagem linfática"), false);
  assert.equal(isWhatsappWalkInService("Banho de Lua"), false);
  assert.match(dapServiceInformationReply, /ordem de chegada/i);
  assert.match(dapServiceInformationReply, /R\$ 200/);
  assert.match(dapServiceInformationReply, /resultados variam/i);
  assert.doesNotMatch(dapServiceInformationReply, /elimina toxinas|garante emagrecimento/i);
});

test("removes professional names from replies without replacing the client's name", () => {
  assert.equal(
    removeWhatsappProfessionalNames(
      "Olá, Camila! Tenho 16h com Gabriela Silva e 17h com Paula Costa.",
      ["Gabriela Silva", "Paula Costa"],
      "Camila",
    ),
    "Olá, Camila! Tenho 16h com a equipe e 17h com a equipe.",
  );
});

test("identifies tanning services and rejects the booking safely", () => {
  assert.equal(isTanningService("Bronzeamento em máquina"), true);
  assert.equal(isTanningService("Marquinha natural"), true);
  assert.equal(isTanningService("Sessão premium", "Bronzeamento"), true);
  assert.equal(isTanningService("Banho de Lua", "Bronze"), false);
  assert.equal(isTanningService("Banho de Lua com bronze", "Bronze"), true);
  assert.equal(isTanningService("Massagem relaxante"), false);
  assert.match(pregnancyTanningRefusal, /não realizamos bronzeamento durante a gravidez/i);
  assert.doesNotMatch(pregnancyTanningRefusal, /outros serviços/i);
});

test("recognizes Spa de Banhos as a walk-in service and gives the correct preparation details", () => {
  assert.equal(isSpaBathServiceRequest("Quero fazer Spa de Banhos"), true);
  assert.equal(isWhatsappWalkInService("Spa de Banhos"), true);
  assert.equal(isWhatsappWalkInService("Banho de Lua"), false);
  assert.match(spaBathServiceInformationReply, /traga uma toalha e um biquíni/i);
  assert.match(spaBathServiceInformationReply, /alugamos por R\$ 5/i);
  assert.match(spaBathServiceInformationReply, /tapa-sexy por R\$ 10/i);
  assert.match(spaBathServiceInformationReply, /ordem de chegada/i);
  assert.match(spaBathServiceInformationReply, /não precisa agendar/i);
});

test("recognizes Banho de Lua offers and distinguishes the two banner prices", () => {
  assert.equal(isBathMoonServiceRequest("Quero saber do Banho de Lua"), true);
  assert.equal(isBathMoonServiceRequest("Quero Spa de Banhos"), false);
  assert.equal(getWhatsappBathMoonBannerSelection("Quero o clareador de 7 passos"), "clarifying");
  assert.equal(getWhatsappBathMoonBannerSelection("Quero o de 5 passos"), "five-step");
  assert.match(bathMoonBannerInformationReply(null), /R\$ 120/);
  assert.match(bathMoonBannerInformationReply(null), /R\$ 150/);
  assert.match(bathMoonBannerInformationReply("clarifying"), /6 áreas de atrito/i);
});

test("recognizes a natural-bronze follow-up from recent context and honors explicit full-info requests", () => {
  assert.equal(
    getWhatsappTanningFlow(
      "Minha segunda, quero fazer natural amanhã",
      "Queria saber sobre o bronzeamento. O bronzeamento em máquina é por ordem de chegada?",
    ),
    "natural",
  );
  assert.equal(
    getWhatsappTanningFlow(
      "Queria saber sobre o bronzeamento. Tem que agendar?",
      "",
    ),
    "unspecified",
  );
  assert.equal(
    getWhatsappTanningFlow(
      "Então posso ir amanhã às 09h?",
      "Quero fazer bronzeamento natural.",
    ),
    "natural",
  );
  assert.equal(getWhatsappTanningFlow("Quero fazer uma massagem amanhã", ""), null);
  assert.equal(isExplicitWhatsappBronzeInfoRequest("Pode me informar tudo sobre o bronze?"), true);
  assert.equal(isExplicitWhatsappBronzeInfoRequest("Quero fazer natural amanhã"), false);
  assert.equal(
    getWhatsappTanningFlow("Pode me informar tudo?", "Falávamos sobre bronzeamento natural."),
    "unspecified",
  );
  assert.equal(
    isWhatsappTanningVisitIntent(
      "Quero fazer um bronzeamento com minha amiga, pode me explicar melhor o natural?",
    ),
    true,
  );
  assert.equal(
    isWhatsappTanningVisitIntent(
      "Então posso ir amanhã às 09h?",
      "Quero fazer um bronzeamento com minha amiga.",
    ),
    true,
  );
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

test("avoids unsolicited bronze audio and never retries a pre-recorded clip in the conversation", () => {
  const inferredBronzeClip = resolveRequestedWhatsappAudioClip(null, "bronze");
  assert.equal(inferredBronzeClip, null);
  assert.equal(shouldSendBronzeAudio(inferredBronzeClip === "bronze", false), false);
  assert.equal(resolveRequestedWhatsappAudioClip(null, "combos"), "combos");
  const selectedBronzeClip = resolveRequestedWhatsappAudioClip("bronze", "bronze");
  assert.equal(selectedBronzeClip, "bronze");
  assert.equal(shouldSendBronzeAudio(selectedBronzeClip === "bronze", false), true);
  assert.equal(shouldSendBronzeAudio(selectedBronzeClip === "bronze", true), false);
  assert.equal(shouldSendBronzeAudio(false, false), false);
  assert.equal(shouldSendBronzeAudio(true, false, true), false);
  assert.equal(shouldSendWhatsappAudioClip(true, false), true);
  assert.equal(shouldSendWhatsappAudioClip(true, true), false);
  assert.equal(shouldSendWhatsappAudioClip(false, true), false);
  assert.match(bronzeMethodDifferenceReply, /ordem de chegada/i);
  assert.match(bronzeMethodDifferenceReply, /das 07h30 às 11h/i);
  assert.match(bronzeAudioUnavailableReply, /das 07h30 às 11h/i);
  assert.doesNotMatch(bronzeMethodDifferenceReply, /exposição solar/i);
  assert.doesNotMatch(bronzeMethodDifferenceReply, /Protocolo Neon/i);
  assert.match(bronzeAudioUnavailableReply, /Não consegui enviar o áudio agora/i);
  assert.doesNotMatch(bronzeAudioUnavailableReply, /Protocolo Neon/i);
});

test("bronze sales recommendation uses the confirmed starting price and Neon offer without guaranteeing results", () => {
  assert.match(bronzeNeonRecommendationReply, /a partir de R\$ 150/i);
  assert.match(bronzeNeonRecommendationReply, /3 sessões \+ esfoliação por R\$ 180/i);
  assert.match(bronzeNeonRecommendationReply, /tom dourado de aparência natural/i);
  assert.match(bronzeNeonRecommendationReply, /acabamento mais uniforme/i);
  assert.match(bronzeNeonRecommendationReply, /marquinhas personalizadas/i);
  assert.match(bronzeNeonRecommendationReply, /pode parecer mais iluminada/i);
  assert.doesNotMatch(bronzeNeonRecommendationReply, /garantido|garante|garantir/i);
});

test("asks the bronze method before Neon and recommends it only for machine bronze", () => {
  const common = {
    recentUserContext: "",
    flow: "unspecified",
    visitIntent: true,
    explicitInfoRequest: false,
    pregnancyMentioned: false,
  };
  assert.equal(shouldAskWhatsappBronzeMethod({ ...common, text: "Quero fazer bronzeamento" }), true);
  assert.equal(shouldSuggestWhatsappNeon({ ...common, text: "Quero fazer bronzeamento" }), false);
  assert.equal(shouldAskWhatsappBronzeMethod({ ...common, flow: "machine", text: "Máquina" }), false);
  assert.equal(shouldSuggestWhatsappNeon({ ...common, flow: "machine", text: "Máquina" }), true);
  assert.equal(shouldAskWhatsappBronzeMethod({
    ...common,
    flow: "machine",
    visitIntent: false,
    text: "Você prefere máquina ou natural?",
  }), true);
  assert.equal(shouldSuggestWhatsappNeon({
    ...common,
    flow: "machine",
    visitIntent: false,
    text: "Você prefere máquina ou natural?",
  }), false);
  assert.equal(shouldSuggestWhatsappNeon({
    ...common,
    flow: "machine",
    visitIntent: false,
    text: "Sim, máquina",
  }), true);
  assert.equal(shouldSuggestWhatsappNeon({ ...common, flow: "natural", text: "Quero fazer bronze natural" }), false);
  assert.equal(shouldAskWhatsappBronzeMethod({
    ...common,
    visitIntent: false,
    text: "Bronze precisa agendar?",
  }), false);
  assert.equal(shouldSuggestWhatsappNeon({
    ...common,
    flow: "machine",
    visitIntent: false,
    text: "Bronze em máquina: que horas fecha?",
  }), false);
  assert.equal(shouldSuggestWhatsappNeon({ ...common, text: "Não quero o Neon" }), false);
  assert.equal(shouldSuggestWhatsappNeon({
    ...common,
    text: "Posso ir amanhã?",
    recentUserContext: "Prefiro Glam Potência",
  }), false);
});