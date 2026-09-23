import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type EvolutionConfig = {
  baseUrl: string;
  instance: string | null;
  apiKey: string;
};

const PROVIDER_TIMEOUT_MS = 8_000;

export type EvolutionInstance = {
  name: string;
  state: string;
  connected: boolean;
};

let selectedInstance = process.env["EVOLUTION_INSTANCE"]?.trim() || null;
let configuredWebhookInstance: string | null = null;

export type EvolutionSendResult = {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
};

export type WhatsappDocument = "menu" | "advanced";

const documentFiles: Record<WhatsappDocument, { path: string; fileName: string }> = {
  menu: {
    path: "Cardápio_Spa_&_Bronze_Belém_compressed_1790165039391.pdf",
    fileName: "Cardapio-Spa-e-Bronze-Belem.pdf",
  },
  advanced: {
    path: "Catálogo_-_Serviços_estéticos_avançados_compressed_1790165039392.pdf",
    fileName: "Catalogo-Estetica-Avancada-Spa-e-Bronze-Belem.pdf",
  },
};

const readDocumentFile = async (fileName: string) => {
  const candidates = [
    resolve(process.cwd(), "attached_assets", fileName),
    resolve(process.cwd(), "../../attached_assets", fileName),
  ];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      lastError = error;
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Arquivo não encontrado: ${fileName}`);
};

export const getEvolutionConfig = (): EvolutionConfig | null => {
  const baseUrl = process.env["EVOLUTION_API_URL"]?.replace(/\/+$/, "");
  const apiKey = process.env["EVOLUTION_API_KEY"]?.trim();
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, instance: selectedInstance, apiKey };
};

export const setEvolutionInstance = (instance: string) => {
  selectedInstance = instance.trim() || null;
  return selectedInstance;
};

const qrCodeFromResponse = (body: Record<string, unknown>): string | null => {
  const qr = body.qrcode as Record<string, unknown> | undefined;
  const value = qr?.base64 ?? qr?.base64Image ?? body.base64;
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("data:image") ? value : `data:image/png;base64,${value}`;
};

const pairingCodeFromResponse = (body: Record<string, unknown>): string | null => {
  const qr = body.qrcode as Record<string, unknown> | undefined;
  const value = qr?.pairingCode ?? body.pairingCode;
  return typeof value === "string" && value ? value : null;
};

const getEvolutionWebhookUrl = () => {
  const configuredUrl = process.env["EVOLUTION_WEBHOOK_URL"]?.trim();
  if (configuredUrl) return configuredUrl;
  const devDomain = process.env["REPLIT_DEV_DOMAIN"]?.trim();
  return devDomain ? `https://${devDomain}/api/integrations/evolution/webhook` : null;
};

export const configureEvolutionWebhook = async (instance: string) => {
  const config = getEvolutionConfig();
  const webhookUrl = getEvolutionWebhookUrl();
  if (!config || !webhookUrl || configuredWebhookInstance === instance) return false;

  try {
    const response = await fetch(`${config.baseUrl}/webhook/set/${encodeURIComponent(instance)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: ["MESSAGES_UPSERT"],
        },
      }),
    });
    if (!response.ok) {
      console.warn(`[Evolution] Não foi possível configurar o webhook da instância (HTTP ${response.status})`);
      return false;
    }
    configuredWebhookInstance = instance;
    return true;
  } catch {
    console.warn("[Evolution] Não foi possível alcançar o endpoint de configuração do webhook");
    return false;
  }
};

export const connectEvolutionInstance = async () => {
  const config = getEvolutionConfig();
  if (!config) {
    return {
      created: false,
      instance: "",
      connected: false,
      state: "not_configured",
      message: "WhatsApp não configurado",
      qrCode: null,
      pairingCode: null,
    };
  }

  const instance = config.instance ?? `spa-${randomUUID().slice(0, 8)}`;
  try {
    let response: Response;
    if (config.instance) {
      response = await fetch(
        `${config.baseUrl}/instance/connect/${encodeURIComponent(instance)}`,
        { headers: { apikey: config.apiKey }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) },
      );
    } else {
      response = await fetch(`${config.baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        body: JSON.stringify({
          instanceName: instance,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });
    }
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      return {
        created: false,
        instance,
        connected: false,
        state: `http_${response.status}`,
        message: "Não foi possível gerar o QR Code do WhatsApp",
        qrCode: null,
        pairingCode: null,
      };
    }

    setEvolutionInstance(instance);
    await configureEvolutionWebhook(instance);
    const qrCode = qrCodeFromResponse(body);
    const pairingCode = pairingCodeFromResponse(body);
    const status = String(
      (body.instance as Record<string, unknown> | undefined)?.status ??
      body.state ??
      (qrCode ? "qr_pending" : "created"),
    );
    return {
      created: !config.instance,
      instance,
      connected: ["open", "connected"].includes(status.toLowerCase()),
      state: status,
      message: qrCode
        ? "QR Code gerado. Escaneie com o WhatsApp."
        : "Instância criada. Aguarde a conexão do WhatsApp.",
      qrCode,
      pairingCode,
    };
  } catch (error) {
    return {
      created: false,
      instance,
      connected: false,
      state: "unreachable",
      message: "Não foi possível conectar o WhatsApp",
      qrCode: null,
      pairingCode: null,
    };
  }
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
  if (!config || !config.instance) {
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
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
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

export const sendEvolutionReaction = async (
  phone: string,
  providerMessageId: string,
  reaction = "❤️",
): Promise<EvolutionSendResult> => {
  const config = getEvolutionConfig();
  if (!config || !config.instance || !providerMessageId) {
    return { ok: false, providerMessageId: null, error: "Evolution API não configurada" };
  }

  try {
    const response = await fetch(
      `${config.baseUrl}/message/sendReaction/${encodeURIComponent(config.instance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        body: JSON.stringify({
          key: {
            remoteJid: `${normalizeWhatsappPhone(phone)}@s.whatsapp.net`,
            fromMe: false,
            id: providerMessageId,
          },
          reaction,
        }),
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
      providerMessageId: typeof key?.id === "string" ? key.id : null,
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

export const sendEvolutionDocument = async (
  phone: string,
  document: WhatsappDocument,
  caption: string,
): Promise<EvolutionSendResult> => {
  const config = getEvolutionConfig();
  if (!config || !config.instance) {
    return { ok: false, providerMessageId: null, error: "WhatsApp não configurado" };
  }

  try {
    const file = documentFiles[document];
    const media = (await readDocumentFile(file.path)).toString("base64");
    const response = await fetch(
      `${config.baseUrl}/message/sendMedia/${encodeURIComponent(config.instance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        body: JSON.stringify({
          number: normalizeWhatsappPhone(phone),
          mediatype: "document",
          mimetype: "application/pdf",
          caption,
          media,
          fileName: file.fileName,
        }),
      },
    );
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const providerError = typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : typeof body.response === "string"
            ? body.response
            : JSON.stringify(body).slice(0, 500) || "resposta vazia do provedor";
      return {
        ok: false,
        providerMessageId: null,
        error: `Evolution API ${response.status}: ${providerError}`,
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
    return { configured: false, connected: false, instance: "", state: "not_configured", message: "WhatsApp não configurado" };
  }
  if (!config.instance) {
    return { configured: true, connected: false, instance: "", state: "no_instance_selected", message: "Clique em “Gerar QR Code” para conectar o WhatsApp" };
  }
  try {
    const response = await fetch(
      `${config.baseUrl}/instance/connectionState/${encodeURIComponent(config.instance)}`,
      { headers: { apikey: config.apiKey }, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) },
    );
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (response.status === 404) {
      const instancesResponse = await fetch(`${config.baseUrl}/instance/fetchInstances`, {
        headers: { apikey: config.apiKey },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
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
            message: "A conexão do WhatsApp não foi encontrada",
          };
        }
        const nested = match.instance as Record<string, unknown> | undefined;
        const state = String(match.connectionStatus ?? nested?.connectionStatus ?? nested?.state ?? "unknown");
        return {
          configured: true,
          connected: ["open", "connected"].includes(state.toLowerCase()),
          instance: config.instance,
          state,
          message: `Status do WhatsApp: ${state}`,
        };
      }
    }
    const state = String(
      (body.instance as Record<string, unknown> | undefined)?.state ??
      body.state ??
      (response.ok ? "unknown" : `http_${response.status}`),
    );
    const connected = response.ok && ["open", "connected"].includes(state.toLowerCase());
    if (connected) await configureEvolutionWebhook(config.instance);
    return {
      configured: true,
      connected,
      instance: config.instance,
      state,
      message: connected
        ? "WhatsApp conectado"
        : response.ok && ["connecting", "qr_pending", "created"].includes(state.toLowerCase())
          ? "Aguardando leitura do QR Code"
        : response.status === 401 || response.status === 403
          ? "Não foi possível autenticar a conexão do WhatsApp"
          : "Não foi possível consultar o status do WhatsApp",
    };
  } catch {
    return {
      configured: true,
      connected: false,
      instance: config.instance,
      state: "unreachable",
      message: "Não foi possível consultar o status do WhatsApp",
    };
  }
};

const parseEvolutionInstances = (value: unknown): EvolutionInstance[] => {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const record = item as Record<string, unknown>;
      const nested = record.instance as Record<string, unknown> | undefined;
      const name = String(record.name ?? nested?.instanceName ?? nested?.name ?? "").trim();
      const state = String(record.connectionStatus ?? nested?.connectionStatus ?? nested?.state ?? "unknown");
      return { name, state, connected: ["open", "connected"].includes(state.toLowerCase()) };
    })
    .filter((item) => item.name);
};

export const listEvolutionInstances = async (): Promise<EvolutionInstance[]> => {
  const config = getEvolutionConfig();
  if (!config) return [];
  const response = await fetch(`${config.baseUrl}/instance/fetchInstances`, {
    headers: { apikey: config.apiKey },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const body = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(`Evolution API respondeu com HTTP ${response.status}`);
  }
  return parseEvolutionInstances(body);
};