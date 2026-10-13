export type EvolutionErrorDetails = {
  providerCode?: string;
  providerMessage?: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const redactProviderMessage = (value: string) =>
  value
    .replace(
      /\b(api[\s_-]?key|authorization|token|password)\b\s*[:=]\s*["']?[^,;\s"'}]+/gi,
      "$1=[redacted]",
    )
    .replace(/\b\d{8,}\b/g, "[redacted-number]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

export const parseEvolutionResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const getEvolutionErrorDetails = (value: unknown): EvolutionErrorDetails => {
  const root = asRecord(value);
  const error = asRecord(root.error);
  const rawCode = [error.code, root.code].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
  );
  const rawMessage = [
    typeof value === "string" ? value : null,
    error.message,
    root.message,
    root.error,
    root.description,
  ].find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);

  return {
    ...(rawCode ? { providerCode: rawCode.trim().slice(0, 80) } : {}),
    ...(rawMessage ? { providerMessage: redactProviderMessage(rawMessage) } : {}),
  };
};
