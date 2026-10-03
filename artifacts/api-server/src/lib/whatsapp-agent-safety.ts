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

export const isClientOnTheWay = (value: string) => {
  const normalized = normalizeSafetyText(value);
  const negativeArrival =
    /\bnao\s+(?:estou|to|vou)\s+(?:a caminho|no caminho|indo|chegando|perto|na porta)\b|\bnao\s+cheguei\b/.test(
      normalized,
    );
  if (negativeArrival) return false;

  return /\b(?:estou|to|vou)\s+(?:a caminho|no caminho|indo|chegando|perto|na porta)\b/.test(
    normalized,
  ) || /\b(?:a caminho|no caminho|chegando|ja cheguei|cheguei|acabei de chegar)\b/.test(
    normalized,
  );
};

export const clientOnTheWayReply =
  "Que bom! Estamos te aguardando por aqui. Venha com cuidado, até já! 🤎";

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