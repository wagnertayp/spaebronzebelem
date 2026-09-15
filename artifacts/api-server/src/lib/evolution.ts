type EvolutionConfig = {
  baseUrl: string;
  instance: string;
  apiKey: string;
};

export type EvolutionSendResult = {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
};

export const getEvolutionConfig = (): EvolutionConfig | null => {
  const baseUrl = process.env["EVOLUTION_API_URL"]?.replace(/\/+$/, "");
  const instance = process.env["EVOLUTION_INSTANCE"]?.trim();
  const apiKey = process.env["EVOLUTION_API_KEY"]?.trim();
  if (!baseUrl || !instance || !apiKey) return null;
  return { baseUrl, instance, apiKey };
};

export const normalizeWhatsappPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
};

export const sendEvolutionText = async (
  phone: string,
  text: string,
): Promise<EvolutionSendResult> => {
  const config = getEvolutionConfig();
  if (!config) {
    return { ok: false, providerMessageId: null, error: "Evolution API não configurada" };
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/message/sendText/${encodeURIComponent(config.instance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        body: JSON.stringify({ number: normalizeWhatsappPhone(phone), text }),
      },
    );
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        providerMessageId: null,
        error: `Evolution API ${response.status}: ${String(body.message ?? body.error ?? "erro desconhecido")}`,
      };
    }
    const key = body.key as Record<string, unknown> | undefined;
    return {
      ok: true,
      providerMessageId: typeof key?.id === "string"
        ? key.id
        : typeof body.messageId === "string"
          ? body.messageId
          : null,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      providerMessageId: null,
      error: error instanceof Error ? error.message : "Falha de conexão com a Evolution API",
    };
  }
};

export const getEvolutionConnection = async () => {
  const config = getEvolutionConfig();
  if (!config) {
    return { configured: false, connected: false, instance: "", state: "not_configured", message: "Evolution API não configurada" };
  }
  try {
    const response = await fetch(
      `${config.baseUrl}/instance/connectionState/${encodeURIComponent(config.instance)}`,
      { headers: { apikey: config.apiKey } },
    );
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status === 404) {
      const instancesResponse = await fetch(`${config.baseUrl}/instance/fetchInstances`, {
        headers: { apikey: config.apiKey },
      }).catch(() => null);
      if (instancesResponse?.ok) {
        const instancesBody = await instancesResponse.json().catch(() => []) as unknown;
        const instances = Array.isArray(instancesBody) ? instancesBody : [];
        const match = instances.find((item) => {
          const record = item as Record<string, unknown>;
          const nested = record.instance as Record<string, unknown> | undefined;
          return String(record.name ?? nested?.instanceName ?? nested?.name ?? "") === config.instance;
        }) as Record<string, unknown> | undefined;
        if (!match) {
          return {
            configured: true,
            connected: false,
            instance: config.instance,
            state: "instance_not_found",
            message: "A chave respondeu, mas a instância configurada não foi encontrada",
          };
        }
        const nested = match.instance as Record<string, unknown> | undefined;
        const state = String(match.connectionStatus ?? nested?.connectionStatus ?? nested?.state ?? "unknown");
        return {
          configured: true,
          connected: ["open", "connected"].includes(state.toLowerCase()),
          instance: config.instance,
          state,
          message: `Instância encontrada: ${state}`,
        };
      }
    }
    const state = String(
      (body.instance as Record<string, unknown> | undefined)?.state ??
      body.state ??
      (response.ok ? "unknown" : `http_${response.status}`),
    );
    const connected = response.ok && ["open", "connected"].includes(state.toLowerCase());
    return {
      configured: true,
      connected,
      instance: config.instance,
      state,
      message: connected
        ? "WhatsApp conectado"
        : response.status === 401 || response.status === 403
          ? "A Evolution API recusou a chave ou a instância"
          : `Evolution API respondeu com HTTP ${response.status}`,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      instance: config.instance,
      state: "unreachable",
      message: "Não foi possível consultar a Evolution API",
    };
  }
};