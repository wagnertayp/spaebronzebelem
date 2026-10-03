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