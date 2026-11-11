export const normalizeWhatsappPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.startsWith("55")) return digits;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
};

export const evolutionRecipient = (value: string): string =>
  value.includes("@") ? value.trim() : normalizeWhatsappPhone(value);

export const evolutionRecipientJid = (value: string): string =>
  value.includes("@")
    ? value.trim()
    : `${normalizeWhatsappPhone(value)}@s.whatsapp.net`;
