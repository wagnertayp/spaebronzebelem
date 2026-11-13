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

export const isWhatsappPregnancyScreenQuestion = (value: string) => {
  const normalized = normalizeSafetyText(value);
  return normalized.includes("?") &&
    /\b(?:gravida|gravidez|gestante)\b/.test(normalized) &&
    /\b(?:voce|existe|possibilidade|chance|esta)\b/.test(normalized);
};

export type WhatsappPregnancyScreenAnswer = "pregnant" | "not_pregnant" | "unclear";

export const getWhatsappPregnancyScreenAnswer = (
  value: string,
  { acceptContextualShortDenial = false }: { acceptContextualShortDenial?: boolean } = {},
): WhatsappPregnancyScreenAnswer => {
  const normalized = normalizeSafetyText(value);
  const segments = normalized
    .split(/[\n.!?,;]+/)
    .map((segment) => segment.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);
  let explicitStatus: WhatsappPregnancyScreenAnswer | null = null;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index]!;
    if (
      /\bnao\b.{0,24}\b(?:sei|acho|tenho certeza|tenho duvida)\b/.test(segment) ||
      /^(?:nao sei|nao tenho certeza|nao tenho duvida)$/.test(segment)
    ) {
      explicitStatus = "pregnant";
      break;
    }
    if (
      /\bnao\b.{0,30}\b(?:estou|to|sou|tenho|existe|ha|posso)\b.{0,24}\b(?:gravida|gestante|gravidez|possibilidade)\b/.test(segment) ||
      /^(?:nao|nao estou|nao to|nao sou)$/.test(segment) && mentionsPregnancy(value)
    ) {
      explicitStatus = "not_pregnant";
      break;
    }
    if (
      /\b(?:estou|to|sou|talvez|possivelmente|posso estar|acho que sim)\b.{0,24}\b(?:gravida|gestante|gravidez|possibilidade)\b/.test(segment)
    ) {
      explicitStatus = "pregnant";
      break;
    }
  }
  if (explicitStatus) return explicitStatus;

  const shortAnswer = segments
    .map((segment) => segment.replace(/^\s*\d+\.\s*/, "").trim())
    .find((segment) => /^(?:sim|nao|talvez|possivelmente|acho que sim|nao nao)$/.test(segment));
  if (shortAnswer === "sim" || shortAnswer === "talvez" || shortAnswer === "possivelmente" || shortAnswer === "acho que sim") {
    return "pregnant";
  }
  if (shortAnswer === "nao" || shortAnswer === "nao nao") return "not_pregnant";
  if (
    acceptContextualShortDenial &&
    segments.some((segment) => /^(?:nao estou|nao to|nao sou)(?:\s+(?:kk+|rs+))?$/.test(segment))
  ) {
    return "not_pregnant";
  }
  return "unclear";
};

export const getWhatsappPregnancyAnswerFromHistory = (
  history: Array<{ role: "user" | "assistant"; content: string }>,
): WhatsappPregnancyScreenAnswer | null => {
  let latestScreenQuestionIndex = -1;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.role === "assistant" && isWhatsappPregnancyScreenQuestion(message.content)) {
      latestScreenQuestionIndex = index;
      break;
    }
  }

  if (latestScreenQuestionIndex >= 0) {
    const answerMessages: string[] = [];
    for (const message of history.slice(latestScreenQuestionIndex + 1)) {
      if (message.role === "assistant") break;
      if (message.role === "user") answerMessages.push(message.content);
    }
    const answerAfterQuestion = answerMessages.join("\n");
    const answer = getWhatsappPregnancyScreenAnswer(answerAfterQuestion, {
      acceptContextualShortDenial: true,
    });
    if (answer !== "unclear") return answer;
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.role !== "user" || !mentionsPregnancy(message.content)) continue;
    const answer = getWhatsappPregnancyScreenAnswer(message.content);
    if (answer !== "unclear") return answer;
  }
  return null;
};

export const isExplicitWhatsappPregnancyDenial = (value: string) =>
  getWhatsappPregnancyScreenAnswer(value) === "not_pregnant" &&
  /\b(?:gravida|gestante|gravidez|possibilidade)\b/.test(normalizeSafetyText(value));

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

export const isBathMoonServiceRequest = (value: string) =>
  /\bbanho\s+de\s+lua\b/.test(normalizeSafetyText(value));

export const isGlutealHarmonizationRequest = (value: string) =>
  /\bharmonizacao\b.{0,30}\bglute(?:a|o|os|as)?\b|\bglute(?:a|o|os|as)\b.{0,30}\bharmonizacao\b/.test(
    normalizeSafetyText(value),
  );

export const glutealHarmonizationInformationReply = `Olá, maravilhosa! 💛 A harmonização glútea é um tratamento planejado conforme o que você deseja melhorar: volume, contorno, firmeza ou assimetria.

O ácido hialurônico pode proporcionar mais volume e projeção, enquanto os bioestimuladores estimulam a produção de colágeno, ajudando na firmeza da pele. ✨

Primeiro, fazemos uma avaliação com a Dra. Paula para entender seu objetivo e indicar o tratamento adequado. A avaliação custa R$100, e esse valor é descontado do protocolo se você fechar em até 30 dias.

Vamos agendar a sua avaliação, meu amor? 🥰

https://www.instagram.com/reel/Ddta6VMpQ2S/?exln=ajJ4ZGV2c3Q1YjV0`;

export type WhatsappBathMoonBanner = "five-step" | "clarifying";

export const getWhatsappBathMoonBannerSelection = (
  value: string,
): WhatsappBathMoonBanner | null => {
  const normalized = normalizeSafetyText(value);
  if (/\b(?:clareador|clareadora|7 passos|sete passos|argila branca|dolomita|6 areas|seis areas)\b/.test(normalized)) {
    return "clarifying";
  }
  if (/\b(?:5 passos|cinco passos|tradicional|normal)\b/.test(normalized)) {
    return "five-step";
  }
  return null;
};

export const isWhatsappWalkInService = (value: string) =>
  isDapServiceRequest(value) || isSpaBathServiceRequest(value);

export const dapServiceInformationReply =
  "O DAP (Drenagem de Alta Performance) trabalha abdômen, pernas e braços; dura cerca de 2h, com 40 min de manta, 40 min de drenagem corporal e uso de nutracêuticos, por R$ 200. O atendimento é por ordem de chegada; os resultados variam e não são garantidos. 🤎";

export const spaBathServiceInformationReply =
  "O Spa de Banhos custa R$ 40. Traga uma toalha e um biquíni. Se não tiver toalha, alugamos por R$ 5; se não tiver biquíni, montamos um tapa-sexy por R$ 10. Não precisa agendar: o atendimento é por ordem de chegada, nos dias e horários de funcionamento do Spa. 🤎";

export const bathMoonBannerInformationReply = (
  selection: WhatsappBathMoonBanner | null,
) => {
  if (selection === "five-step") {
    return "Banho de Lua de 5 passos: R$ 120. Inclui parafina, loção clareadora hipoalergênica, esfoliante orgânico e mousse hidratante com óleo glicerinado. Brindes: coquetel de frutas com picolé e máscara facial de argila rosa. 🤎";
  }
  if (selection === "clarifying") {
    return "Banho de Lua Clareador de 7 passos: R$ 150. É voltado ao clareamento dos pelos e da pele, com base de argila branca e dolomita, e foco em 6 áreas de atrito: axilas, virilha, joelhos, cotovelos, nádegas e pescoço. Inclui coquetel de frutas com picolé e máscara facial de ouro ou argila branca. 🤎";
  }
  return "O Banho de Lua é um ritual voltado ao clareamento dos pelos e à aparência dourada. Temos 5 passos por R$ 120, com parafina, loção clareadora, esfoliação e mousse hidratante, ou Clareador de 7 passos por R$ 150, com foco em 6 áreas de atrito. As duas opções incluem coquetel de frutas com picolé e máscara facial. Qual opção te interessa? 🤎";
};

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

export const getRememberedWhatsappTanningFlowForPriceFollowUp = (
  currentText: string,
  recentUserContext: string,
): WhatsappTanningFlow | null => {
  const current = normalizeSafetyText(currentText);
  if (
    !/\b(?:valores?|precos?|quanto custa|quanto fica|me manda|mandar valores|me passa|passar valores)\b/.test(current) ||
    /\b(?:natural|solar|sol|maquina)\b/.test(current) ||
    !isTanningService(recentUserContext)
  ) return null;

  const recentUserMessages = recentUserContext.split(/\n+/).reverse();
  for (const message of recentUserMessages) {
    const normalized = normalizeSafetyText(message);
    const mentionsNatural = /\b(?:bronze(?:amento)?\s+(?:natural|solar|no sol|ao sol)|marquinha natural|bronze solar)\b/.test(normalized);
    const mentionsMachine = /\b(?:bronze(?:amento)?\s+(?:em|na)\s+maquina|maquina)\b/.test(normalized);
    if (mentionsNatural && mentionsMachine) return null;
    if (mentionsNatural) return "natural";
    if (mentionsMachine) return "machine";
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
    /\b(?:quero|queria|pretendo|vamos|vou)\s+(?:ir|fazer|passar)\b.{0,40}\b(?:bronze|bronzeamento|natural|maquina)\b/.test(
      current,
    );
  const currentExplicitArrivalIntent =
    currentMentionsTanning &&
    /\b(?:estou indo|to indo|estamos indo|vamos indo|estou chegando|to chegando|vou chegar|vou passar|a caminho)\b/.test(
      current,
    );
  const currentIsVisitFollowUp =
    /\b(?:posso ir|podemos ir|vou ir|estou indo|estamos indo|estarei|estaremos|vou estar|vou chegar|vou passar|chego|chegamos|amanha|hoje|as [0-2]?\d(?::[0-5]\d)?)\b/.test(
      current,
    );
  const currentIsShortServiceAnswer =
    current.length <= 50 && currentMentionsTanning;

  return currentExplicitVisitIntent ||
    currentExplicitArrivalIntent ||
    (previousExplicitTanningIntent && (currentIsVisitFollowUp || currentIsShortServiceAnswer));
};

export type WhatsappTanningVisitDay = "today" | "tomorrow";

export const getWhatsappTanningVisitDay = (
  value: string,
): WhatsappTanningVisitDay | null => {
  const normalized = normalizeSafetyText(value);
  if (/\b(?:depois de amanha|amanha)\b/.test(normalized)) return "tomorrow";
  if (/\b(?:hoje|agora)\b/.test(normalized)) return "today";
  return null;
};

export const isWhatsappTanningVisitConfirmation = (
  currentText: string,
  previousAssistantMessage: string,
  conversationContext: string,
) => {
  const current = normalizeSafetyText(currentText);
  const previous = normalizeSafetyText(previousAssistantMessage);
  if (
    getWhatsappTanningVisitDay(currentText) === "tomorrow" &&
    getWhatsappTanningVisitDay(previousAssistantMessage) === "today"
  ) {
    return false;
  }
  const contextHasTanning = isTanningService(previousAssistantMessage) ||
    isTanningService(conversationContext);
  const assistantAskedAboutVisit =
    previous.includes("?") &&
    /\b(?:vir|vem|ir|comparecer|fila|te colocar|vai fazer bronze|vai vir|vai ir|pretende vir|quer vir|quer fazer bronze)\b/.test(
      previous,
    );
  const currentConfirmsVisit =
    /^(?:sim|vou sim|vamos sim|com certeza|confirmo(?: que vou)?|confirmando que vou|confirmado|confirmada|irei|estarei|vou|vamos|pode me colocar|pode colocar)\b/.test(
      current,
    );
  return contextHasTanning && assistantAskedAboutVisit && currentConfirmsVisit;
};

export const isWhatsappTanningVisitServiceAnswer = (
  currentText: string,
  previousAssistantMessage: string,
) => {
  const current = normalizeSafetyText(currentText);
  const previous = normalizeSafetyText(previousAssistantMessage);
  const assistantAskedWhichVisitService =
    /\bqual\s+(?:servico|procedimento)\b.{0,45}\b(?:vir|ir|atender|fazer)\b/.test(previous) ||
    /\b(?:vir|ir|atender|fazer)\b.{0,45}\bqual\s+(?:servico|procedimento)\b/.test(previous);
  return assistantAskedWhichVisitService &&
    current.length <= 60 &&
    isTanningService(currentText);
};

export const pregnancyTanningRefusal =
  "Por cuidado, não realizamos bronzeamento durante a gravidez. 🤎";