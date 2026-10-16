const normalizeSafetyText = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const mentionsPregnancy = (value: string) =>
  /\b(?:gravida|gravidas|gravido|gravidos|gestante|gestantes|gravidez)\b/.test(
    normalizeSafetyText(value),
  );

export type WhatsappArrivalUpdate = "arrived" | "on_the_way" | "eta";

export const getWhatsappArrivalUpdate = (value: string): WhatsappArrivalUpdate | null => {
  const normalized = normalizeSafetyText(value);
  const negativeArrival =
    /\bnao\b[\s\S]{0,32}\b(?:estou|to|vou|consigo|consegui|cheguei|chegar|indo|chegando|perto|na porta|a caminho|no caminho)\b/.test(
      normalized,
    );
  if (negativeArrival) return null;

  if (
    /\b(?:ja cheguei|cheguei|acabei de chegar)\b/.test(normalized) ||
    /\b(?:estou|to)\s+(?:aqui|no spa|na clinica|na porta)\b/.test(normalized)
  ) {
    return "arrived";
  }

  if (
    /\b(?:vou|consigo|conseguirei|devo|pretendo)\s+(?:conseguir\s+)?(?:chegar|estar|passar|ir)\b/.test(normalized)
  ) {
    return "eta";
  }

  if (
    /\b(?:vou|vamos|estou|to)\s+(?:(?:indo|seguir)\s+)?de\s+(?:uber|99|taxi)\b/.test(normalized) &&
    !value.trim().endsWith("?")
  ) {
    return "on_the_way";
  }

  if (
    /\b(?:estou|to|vou)\s+(?:a caminho|no caminho|indo|chegando|perto|na porta)\b/.test(normalized) ||
    /\b(?:a caminho|no caminho|chegando)\b/.test(normalized)
  ) {
    return "on_the_way";
  }

  return null;
};

export const isClientOnTheWay = (value: string) => {
  return getWhatsappArrivalUpdate(value) !== null;
};

export const clientOnTheWayReply =
  "Perfeito, estamos te aguardando! Ao chegar, é só avisar a recepção; venha com cuidado. 🤎";

export const clientArrivalEtaReply =
  "Obrigada por avisar! A equipe fica ciente e te aguarda. 🤎";

export const isWhatsappDecisionDeferral = (value: string) =>
  /\b(?:um momento|um minutinho|deixa eu ver|vou (?:ver|conferir|confirmar|consultar)|vou falar com|vou combinar com|preciso falar com|confirmo depois|te aviso depois)\b/.test(
    normalizeSafetyText(value),
  );

export const whatsappDecisionDeferralReply =
  "Claro, sem pressa! Quando decidir, me avise por aqui e eu confiro novamente os horários disponíveis. 🤎";

export const isWhatsappAcceptanceOfServiceOffer = (
  currentText: string,
  previousAssistantText: string,
) => {
  const response = normalizeSafetyText(currentText).replace(/[.!?]+$/g, "").trim();
  const previous = normalizeSafetyText(previousAssistantText);
  const isSimpleAcceptance =
    /^(?:eu quero|quero|sim|sim quero|quero sim|pode|pode ser|claro|com certeza|quero conhecer)$/.test(
      response,
    );
  const previousOfferedOtherServices =
    /\b(?:outras opcoes|opcoes de cuidados|outros servicos|servicos para gestante)\b/.test(previous) &&
    /\b(?:quer|posso|passar|conhecer|mostrar|apresentar)\b/.test(previous);
  return isSimpleAcceptance && previousOfferedOtherServices;
};

export const isDapServiceRequest = (value: string) => {
  const normalized = normalizeSafetyText(value);
  return /\bd\.?\s*a\.?\s*p\.?\b|\bdrenagem\s+(?:de\s+)?alta\s+performance\b/.test(normalized);
};

export const isSpaBathServiceRequest = (value: string) =>
  /\bspa\s+de\s+banhos?\b/.test(normalizeSafetyText(value));

export const isWhatsappWalkInService = (value: string) =>
  isDapServiceRequest(value) || isSpaBathServiceRequest(value);

export const dapServiceInformationReply =
  "O DAP (Drenagem de Alta Performance) trabalha abdômen, pernas e braços; dura cerca de 2h, com 40 min de manta, 40 min de drenagem corporal e uso de nutracêuticos, por R$ 200. O atendimento é por ordem de chegada; os resultados variam e não são garantidos. 🤎";

export const spaBathServiceInformationReply =
  "O Spa de Banhos custa R$ 40. Traga uma toalha e um biquíni. Se não tiver toalha, alugamos por R$ 5; se não tiver biquíni, montamos um tapa-sexy por R$ 10. Não precisa agendar: o atendimento é por ordem de chegada, nos dias e horários de funcionamento do Spa. 🤎";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const removeWhatsappProfessionalNames = (
  text: string,
  professionalNames: string[],
  clientName = "",
) => {
  const clientLabel = clientName.trim();
  const clientIsPhone = /^\+?[\d\s()-]+$/.test(clientLabel);
  const placeholder = "__WHATSAPP_CLIENT_NAME__";
  const clientTokens = new Set(
    clientIsPhone
      ? []
      : normalizeSafetyText(clientLabel).split(/\s+/).filter(Boolean),
  );
  let result = text;

  if (clientLabel && !clientIsPhone) {
    result = result.replace(
      new RegExp(escapeRegExp(clientLabel).replace(/\s+/g, "\\s+"), "giu"),
      placeholder,
    );
  }

  const variants = new Set<string>();
  for (const professionalName of professionalNames) {
    const parts = professionalName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    variants.add(parts.join(" "));
    if (parts[0] && !clientTokens.has(normalizeSafetyText(parts[0]))) {
      variants.add(parts[0]);
    }
  }

  for (const variant of [...variants].sort((a, b) => b.length - a.length)) {
    const pattern = variant
      .split(/\s+/)
      .map(escapeRegExp)
      .join("\\s+");
    result = result.replace(
      new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, "giu"),
      "$1equipe",
    );
  }

  return result
    .replace(/\bcom\s+equipe\b/giu, "com a equipe")
    .replace(/\bpara\s+equipe\b/giu, "para a equipe")
    .replaceAll(placeholder, clientLabel);
};

export const mentionsSpaInfantil = (value: string) =>
  /\bsp(?:a|ar)\s+(?:infantil|(?:para|das)\s+criancas?)\b|\bkids\s+spa\b/.test(
    normalizeSafetyText(value),
  );

export const spaInfantilHandoffReply =
  "Temos sim: o Spa Infantil é um banho à base de hidratante e açúcar, sem chumbo ou amônia, para crianças de 2 a 10 anos. Vou encaminhar você para uma atendente, que pode explicar os detalhes e ajudar com os horários. 🤎";

export const isTanningService = (value: string, category = "") => {
  const serviceName = normalizeSafetyText(value).replace(/\s+/g, " ").trim();
  if (serviceName === "banho de lua") return false;
  return /\b(?:bronze(?:amento|adas?)?|marquinhas?)\b/.test(
    normalizeSafetyText(`${value} ${category}`),
  );
};

export type WhatsappTanningFlow = "natural" | "machine" | "unspecified";

export const getWhatsappTanningFlow = (
  currentText: string,
  recentContext = "",
): WhatsappTanningFlow | null => {
  const current = normalizeSafetyText(currentText);
  const recent = normalizeSafetyText(recentContext);
  const tanningIsInContext =
    isTanningService(currentText) || isTanningService(recentContext);
  if (!tanningIsInContext) return null;

  if (/\b(?:maquina|em maquina|na maquina)\b/.test(current)) return "machine";
  if (
    /\b(?:bronze(?:amento)? natural|marquinha natural)\b/.test(current) ||
    (/\bnatural\b/.test(current) && /\b(?:quero|fazer|prefiro|vou|escolhi)\b/.test(current))
  ) {
    return "natural";
  }
  if (isTanningService(currentText)) return "unspecified";
  if (isExplicitWhatsappBronzeInfoRequest(currentText)) return "unspecified";
  if (/\b(?:posso ir|podemos ir|vou ir|estou indo|amanha|hoje|as [0-2]?\d)\b/.test(current)) {
    if (/\b(?:bronze(?:amento)? natural|marquinha natural)\b/.test(recent)) return "natural";
    if (/\b(?:bronzeamento em maquina|bronze em maquina|na maquina)\b/.test(recent)) return "machine";
    return "unspecified";
  }
  return null;
};

export const isExplicitWhatsappBronzeInfoRequest = (value: string) =>
  /\b(?:informe tudo|me informe tudo|informar tudo|me informar tudo|me conta tudo|me conte tudo|quero saber tudo|me explica tudo|explique tudo|manda o audio|envia o audio|quero o audio)\b/.test(
    normalizeSafetyText(value),
  );

export const isWhatsappTanningVisitIntent = (
  currentText: string,
  recentUserContext = "",
) => {
  const current = normalizeSafetyText(currentText);
  const recent = normalizeSafetyText(recentUserContext);
  const currentMentionsTanning = isTanningService(currentText);
  const previousExplicitTanningIntent =
    /\b(?:quero|queria|pretendo|vamos|vou)\b.{0,45}\b(?:fazer|ir|bronze|bronzeamento|natural|maquina)\b/.test(
      recent,
    );
  const currentExplicitVisitIntent =
    currentMentionsTanning &&
    /\b(?:quero|queria|pretendo|vamos|vou|posso|podemos)\b/.test(current) &&
    /\b(?:fazer|ir|bronze|bronzeamento|natural|maquina)\b/.test(current);
  const currentIsVisitFollowUp =
    /\b(?:posso ir|podemos ir|vou ir|estou indo|estamos indo|amanha|hoje|as [0-2]?\d)\b/.test(
      current,
    );
  const currentIsShortServiceAnswer =
    current.length <= 50 && currentMentionsTanning;

  return currentExplicitVisitIntent ||
    (previousExplicitTanningIntent && (currentIsVisitFollowUp || currentIsShortServiceAnswer));
};

export const pregnancyTanningRefusal =
  "Por cuidado, não realizamos bronzeamento durante a gravidez. 🤎";