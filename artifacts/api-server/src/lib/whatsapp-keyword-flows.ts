type KeywordFlow = {
  id: string;
  name: string;
  keywords: string[];
  enabled: boolean;
  message: string;
  imageUrl: string | null;
};

const normalizeKeywordText = (value: string) =>
  value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

export const matchWhatsappKeywordFlow = <T extends KeywordFlow>(
  text: string,
  flows: T[],
): T | null => {
  const normalizedText = ` ${normalizeKeywordText(text)} `;
  if (!normalizedText.trim()) return null;

  return flows.find((flow) => {
    if (!flow.enabled || !flow.message.trim()) return false;
    return flow.keywords.some((keyword) => {
      const normalizedKeyword = normalizeKeywordText(keyword);
      return normalizedKeyword.length > 1 &&
        normalizedText.includes(` ${normalizedKeyword} `);
    });
  }) ?? null;
};
