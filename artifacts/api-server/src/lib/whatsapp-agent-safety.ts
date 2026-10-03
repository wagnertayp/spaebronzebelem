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
  "Que bom! Estamos te aguardando por aqui. Venha com cuidado, até já! 🤎";

export const clientArrivalEtaReply =
  "Obrigada por avisar! A equipe fica ciente e te aguarda. 🤎";

export const isDapServiceRequest = (value: string) => {
  const normalized = normalizeSafetyText(value);
  return /\bd\.?\s*a\.?\s*p\.?\b|\bdrenagem\s+(?:de\s+)?alta\s+performance\b/.test(normalized);
};

export const isWhatsappWalkInService = (value: string) =>
  isDapServiceRequest(value);

export const dapServiceInformationReply =
  "O DAP (Drenagem de Alta Performance) trabalha abdômen, pernas e braços; dura cerca de 2h, com 40 min de manta, 40 min de drenagem corporal e uso de nutracêuticos, por R$ 200. O atendimento é por ordem de chegada; os resultados variam e não são garantidos. 🤎";

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

export const isTanningService = (value: string, category = "") =>
  /\b(?:bronze(?:amento|adas?)?|marquinhas?)\b/.test(
    normalizeSafetyText(`${value} ${category}`),
  );

export const pregnancyTanningRefusal =
  "Por cuidado, não realizamos bronzeamento durante a gravidez. Se quiser, posso te informar sobre outros serviços, sem avaliar se são indicados para você. 🤎";