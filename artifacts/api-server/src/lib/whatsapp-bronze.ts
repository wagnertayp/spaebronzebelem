export const WHATSAPP_AUDIO_MESSAGE_LABELS = {
  combos: "Áudio pré-gravado enviado: explicação dos combos",
  bronze: "Áudio pré-gravado enviado: informações sobre bronzeamento",
} as const;

export const resolveRequestedWhatsappAudioClip = (
  requestedClip: "combos" | "bronze" | null | undefined,
  inferredClip: "combos" | "bronze" | null,
): "combos" | "bronze" | null =>
  requestedClip ?? (inferredClip === "combos" ? inferredClip : null);

export const shouldSendWhatsappAudioClip = (
  selectedForCurrentTurn: boolean,
  alreadyAttempted: boolean,
) => selectedForCurrentTurn && !alreadyAttempted;

export const shouldSendBronzeAudio = (
  selectedForCurrentTurn: boolean,
  alreadyAttempted: boolean,
  pregnancyMentioned = false,
) => selectedForCurrentTurn && !alreadyAttempted && !pregnancyMentioned;

export const bronzeMethodDifferenceReply =
  "O bronze natural é por ordem de chegada das 07h30 às 11h; o bronze em máquina também é por ordem de chegada, até 20h de segunda a sexta, 18h no sábado e 11h30 no domingo. A equipe pode confirmar contraindicações conforme cada caso. 🤎";

export const bronzeAudioSentReply =
  "Também te enviei um áudio falando sobre o bronzeamento Neon. 🤎";

export const bronzeAudioUnavailableReply =
  "Não consegui enviar o áudio agora. Para não deixar você sem as orientações: o bronze natural começa em R$ 140 e funciona por ordem de chegada das 07h30 às 11h; em máquina começa em R$ 150, é feito na WB Ultra com atendimento individual e leva cerca de 8 a 20 minutos conforme o fototipo, por ordem de chegada até 20h de segunda a sexta, 18h no sábado e 11h30 no domingo. A equipe pode confirmar contraindicações conforme cada caso. 🤎";

export const bronzeTextFallbackReply =
  "Para você já ficar com as orientações por texto: o bronze natural começa em R$ 140 e funciona por ordem de chegada das 07h30 às 11h; em máquina começa em R$ 150, é feito na WB Ultra com atendimento individual e leva cerca de 8 a 20 minutos conforme o fototipo, por ordem de chegada até 20h de segunda a sexta, 18h no sábado e 11h30 no domingo. A equipe pode confirmar contraindicações conforme cada caso. 🤎";

export const promisesWhatsappAudio = (reply: string) => {
  const normalized = reply
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/\bcombos?\b/.test(normalized)) return false;
  return /\b(?:vou|irei|ja vou)\s+(?:te\s+)?(?:enviar|mandar|encaminhar)\b.{0,60}\b(?:audio|gravacao)\b|\b(?:te envio|te mando)\b.{0,60}\b(?:audio|gravacao)\b/.test(normalized);
};

export const bronzeNeonRecommendationReply =
  "Na máquina, temos opções a partir de R$ 150. O Protocolo Neon reúne 3 sessões + esfoliação por R$ 180 e foi pensado para um tom dourado de aparência natural, acabamento mais uniforme e marquinhas personalizadas; o procedimento é rápido e, com os cuidados adequados, a pele pode parecer mais iluminada. Quer que eu te explique como funciona? 🤎";

const normalizeBronzeText = (value: string) =>
  value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const bronzeSalesIntentPattern =
  /\b(?:preco|valor|quanto|opcoes?|pacotes?|recomenda|beneficios?|neon|me indica|qual opcao|quero fazer (?:um )?bronze(?:amento)?|queria fazer (?:um )?bronze(?:amento)?)\b/;

const bronzeLogisticsPattern =
  /\b(?:horario|que horas|agendar|agenda|ordem de chegada|posso ir|onde fica|endereco|aberto|abre|fecha|funcionando)\b/;

const hasSelectedBronzeMachine = (text: string, recentUserContext = "") => {
  const normalizedText = normalizeBronzeText(text);
  const recent = normalizeBronzeText(recentUserContext);
  const explicitChoice =
    /\b(?:prefiro|escolhi|escolho|vou de|decidi por|decidi pela)\b.{0,40}\bmaquina\b|\bquero fazer\b.{0,50}\bmaquina\b|\bbronze(?:amento)? em maquina\b/.test(normalizedText);
  const shortChoice = /^(?:sim[, ]*)?(?:a |em )?maquina[.!?]*$/.test(normalizedText);
  const recentChoice =
    /(?:^|\n)\s*(?:sim[, ]*)?(?:a |em )?maquina\s*[.!?]*(?:\n|$)/.test(recent) ||
    /\b(?:prefiro|escolhi|escolho|vou de|decidi por|decidi pela)\b.{0,40}\bmaquina\b|\bquero fazer\b.{0,50}\bmaquina\b|\bbronze(?:amento)? em maquina\b/.test(recent);
  return explicitChoice || shortChoice || recentChoice;
};

export const shouldAskWhatsappBronzeMethod = ({
  text,
  recentUserContext,
  flow,
  visitIntent,
  explicitInfoRequest,
  pregnancyMentioned,
}: {
  text: string;
  recentUserContext: string;
  flow: "natural" | "machine" | "unspecified" | null;
  visitIntent: boolean;
  explicitInfoRequest: boolean;
  pregnancyMentioned: boolean;
}) => {
  const normalizedText = normalizeBronzeText(text);
  const machineSelected = hasSelectedBronzeMachine(text, recentUserContext);
  const asksToCompareMethods =
    /\b(?:natural|sol)\b.{0,35}\bmaquina\b|\bmaquina\b.{0,35}\b(?:natural|sol)\b|\b(?:comparar|diferenca)\b/.test(normalizedText);
  return !pregnancyMentioned &&
    (flow === "unspecified" || (flow === "machine" && !machineSelected)) &&
    !explicitInfoRequest &&
    !bronzeLogisticsPattern.test(normalizedText) &&
    (visitIntent || bronzeSalesIntentPattern.test(normalizedText) || asksToCompareMethods);
};

export const shouldSuggestWhatsappNeon = ({
  text,
  recentUserContext,
  flow,
  visitIntent,
  explicitInfoRequest,
  pregnancyMentioned,
}: {
  text: string;
  recentUserContext: string;
  flow: "natural" | "machine" | "unspecified" | null;
  visitIntent: boolean;
  explicitInfoRequest: boolean;
  pregnancyMentioned: boolean;
}) => {
  const normalizedText = normalizeBronzeText(text);
  const recent = normalizeBronzeText(recentUserContext);
  const conversation = `${recent}\n${normalizedText}`;
  const machineSelected = hasSelectedBronzeMachine(text, recentUserContext);
  const neonWasDeclined = /\b(?:nao|dispenso)\b.{0,40}\bneon\b/.test(normalizedText);
  const anotherPackageWasChosen =
    /\b(?:escolhi|prefiro|vou ficar com|vou de|decidi pelo|quero fazer)\b.{0,50}\b(?:glam potencia|sparkles potencia|fly gourmet|shine gourmet|flash bronze|maravilhosa basiquinha|marquinha de milhoes|brilho total|bronzeamento carioca|bronze rainha|magic bronze make|magic shine make|insta bronze make)\b/.test(conversation);

  return !pregnancyMentioned &&
    !neonWasDeclined &&
    !anotherPackageWasChosen &&
    flow === "machine" &&
    machineSelected &&
    !explicitInfoRequest &&
    !bronzeLogisticsPattern.test(normalizedText) &&
    (visitIntent || machineSelected || bronzeSalesIntentPattern.test(normalizedText));
};