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

export const isTanningService = (value: string, category = "") =>
  /\b(?:bronze(?:amento|adas?)?|marquinhas?)\b/.test(
    normalizeSafetyText(`${value} ${category}`),
  );

export const pregnancyTanningRefusal =
  "Por cuidado, não realizamos bronzeamento durante a gravidez. Se quiser, posso te informar sobre outros serviços, sem avaliar se são indicados para você. 🤎";