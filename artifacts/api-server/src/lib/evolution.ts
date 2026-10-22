import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evolutionInstanceStore } from "./evolution-instance-repository";
import { getEvolutionErrorDetails, parseEvolutionResponseBody } from "./evolution-error";
import { sendTextWithQuoteFallback } from "./evolution-text-fallback";
import { pairingCodeFromResponse, qrCodeFromResponse } from "./evolution-qr";
import { logger } from "./logger";

type EvolutionConfig = {
  baseUrl: string;
  instance: string | null;
  apiKey: string;
};

const PROVIDER_TIMEOUT_MS = 8_000;
const CONNECTION_ACTION_TIMEOUT_MS = 15_000;
const VOICE_NOTE_RECORDING_DELAY_MS = 30_000;
const VOICE_NOTE_SEND_TIMEOUT_MS = PROVIDER_TIMEOUT_MS + VOICE_NOTE_RECORDING_DELAY_MS;

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : "UnknownError";

export type EvolutionInstance = {
  name: string;
  state: string;
  connected: boolean;
};

let configuredWebhookInstance: string | null = null;
let warnedMissingWebhookInstance: string | null = null;

export type EvolutionSendResult = {
  ok: boolean;
  providerMessageId: string | null;
  error: string | null;
};

export type WhatsappDocument = "menu" | "advanced" | "portfolio";
export type EvolutionReplyReference = {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  message: Record<string, unknown>;
};

const documentFiles: Record<WhatsappDocument, { path: string; fileName: string }> = {
  menu: {
    path: "Cardápio_Spa_&_Bronze_Belém_compressed_1790165039391.pdf",
    fileName: "Cardapio-Spa-e-Bronze-Belem.pdf",
  },
  advanced: {
    path: "Catálogo_-_Serviços_estéticos_avançados_compressed_1790165039392.pdf",
    fileName: "Catalogo-Estetica-Avancada-Spa-e-Bronze-Belem.pdf",
  },
  portfolio: {
    path: "portfolio_procedimentos_1790768629311.pdf",
    fileName: "Portfolio-Harmonizacao-Orofacial-Spa-e-Bronze-Belem.pdf",
  },
};

export type WhatsappAudioClip = "combos" | "bronze";
export type WhatsappDapImage = "before" | "after";
export type WhatsappBathMoonBannerImage = "five-step" | "clarifying";
export type WhatsappBronzeBannerImage = "neon";

const audioFiles: Record<WhatsappAudioClip, { path: string }> = {
  combos: {
    path: "0_EXPLICAÇÃO-DOS-COMBOS-DA-SPAEBRONZE_1790253488359.ogg",
  },
  bronze: {
    path: "1_ÁUDIO-BRONZEAMENTO_1790253488369.ogg",
  },
};

const sessionPreparationImageFile = {
  path: "O_Q_LEVAR_1790254581922.jpeg",
  fileName: "orientacoes-para-sessao-de-bronzeamento.jpeg",
};

const dapImageFiles: Record<WhatsappDapImage, { path: string; fileName: string }> = {
  before: {
    path: "DAP_1791070430775.jpeg",
    fileName: "dap-antes-e-depois-1.jpeg",
  },
  after: {
    path: "DAP_2_1791070430784.jpeg",
    fileName: "dap-antes-e-depois-2.jpeg",
  },
};

const bathMoonBannerFiles: Record<WhatsappBathMoonBannerImage, { path: string; fileName: string }> = {
  "five-step": {
    path: "WhatsApp_Image_2026-10-16_at_14.22.43_(1)_1792172522475.jpeg",
    fileName: "banho-de-lua-5-passos-r120.jpeg",
  },
  clarifying: {
    path: "WhatsApp_Image_2026-10-16_at_14.22.43_1792172522476.jpeg",
    fileName: "banho-de-lua-clareador-7-passos-r150.jpeg",
  },
};

const bronzeBannerFiles: Record<WhatsappBronzeBannerImage, { path: string; fileName: string }> = {
  neon: {
    path: "BRONZE_NEON_1790254720578.jpeg",
    fileName: "bronzeamento-neon.jpeg",
  },
};

const readWhatsappAsset = async (fileName: string) => {
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

export const getEvolutionConfig = async (): Promise<EvolutionConfig | null> => {
  const baseUrl = process.env["EVOLUTION_API_URL"]?.replace(/\/+$/, "");
  const apiKey = process.env["EVOLUTION_API_KEY"]?.trim();
  if (!baseUrl || !apiKey) return null;
  const instance = await evolutionInstanceStore.getSelectedInstance();
  return { baseUrl, instance, apiKey };
};

const getEvolutionWebhookUrl = () => {
  const configuredUrl = process.env["EVOLUTION_WEBHOOK_URL"]?.trim();
  if (configuredUrl) return configuredUrl;
  if (process.env["NODE_ENV"] === "production") return null;
  const devDomain = process.env["REPLIT_DEV_DOMAIN"]?.trim();
  return devDomain ? `https://${devDomain}/api/integrations/evolution/webhook` : null;
};

export const configureEvolutionWebhook = async (
  instance: string,
  { force = false }: { force?: boolean } = {},
) => {
  const config = await getEvolutionConfig();
  const webhookUrl = getEvolutionWebhookUrl();
  if (!config) return false;
  if (!webhookUrl) {
    if (warnedMissingWebhookInstance !== instance) {
      logger.warn(
        { production: process.env["NODE_ENV"] === "production" },
        "[Evolution] EVOLUTION_WEBHOOK_URL não configurada; mensagens recebidas não chegarão ao agente",
      );
      warnedMissingWebhookInstance = instance;
    }
    return false;
  }
  warnedMissingWebhookInstance = null;
  if (!force && configuredWebhookInstance === instance) return true;

  try {
    const webhookTarget = new URL(webhookUrl);
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
      logger.warn(
        { status: response.status },
        "[Evolution] Não foi possível configurar o webhook",
      );
      return false;
    }
    configuredWebhookInstance = instance;
    logger.info(
      {
        webhookEnabled: true,
        webhookHost: webhookTarget.host,
        webhookPath: webhookTarget.pathname,
        webhookEvents: ["MESSAGES_UPSERT"],
      },
      "[Evolution] Webhook de mensagens configurado",
    );
    return true;
  } catch (error) {
    logger.warn(
      { errorName: errorName(error), timeoutMs: PROVIDER_TIMEOUT_MS },
      "[Evolution] Não foi possível alcançar o endpoint de configuração do webhook",
    );
    return false;
  }
};

export const connectEvolutionInstance = async () => {
  const config = await getEvolutionConfig();
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

  let instance = config.instance ?? `spa-${randomUUID().slice(0, 8)}`;
  let created = !config.instance;
  try {
    const createInstance = (instanceName: string) =>
      fetch(`${config.baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        signal: AbortSignal.timeout(CONNECTION_ACTION_TIMEOUT_MS),
        body: JSON.stringify({
          instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });

    let response: Response;
    if (config.instance) {
      response = await fetch(
        `${config.baseUrl}/instance/connect/${encodeURIComponent(instance)}`,
        { headers: { apikey: config.apiKey }, signal: AbortSignal.timeout(CONNECTION_ACTION_TIMEOUT_MS) },
      );
      if (response.status === 404) {
        logger.warn(
          "[Evolution] A instância selecionada não foi encontrada; tentando criar uma nova",
        );
        instance = `spa-${randomUUID().slice(0, 8)}`;
        created = true;
        response = await createInstance(instance);
      }
    } else {
      response = await createInstance(instance);
    }
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      logger.warn(
        { status: response.status },
        "[Evolution] Não foi possível iniciar a conexão do WhatsApp",
      );
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

    await evolutionInstanceStore.setSelectedInstance(instance);
    const webhookReady = await configureEvolutionWebhook(instance, { force: true });
    const qrCode = qrCodeFromResponse(body);
    const pairingCode = pairingCodeFromResponse(body);
    const status = String(
      (body.instance as Record<string, unknown> | undefined)?.status ??
      body.state ??
      (qrCode ? "qr_pending" : "created"),
    );
    const connected = ["open", "connected"].includes(status.toLowerCase());
    const connectionMessage = connected
      ? "WhatsApp já conectado."
      : qrCode
        ? "QR Code gerado. Escaneie com o WhatsApp."
        : pairingCode
          ? "Código de pareamento gerado."
          : "A Evolution API não retornou um QR Code válido. Tente gerar novamente.";
    if (!connected && !qrCode && !pairingCode) {
      logger.warn(
        { instance, state: status, responseKeys: Object.keys(body).sort() },
        "[Evolution] Resposta de conexão sem QR Code válido ou código de pareamento",
      );
    }
    return {
      created,
      instance,
      connected,
      state: status,
      message: webhookReady
        ? connectionMessage
        : `${connectionMessage} Atenção: o webhook de mensagens não foi configurado; a IA não receberá novas mensagens.`,
      qrCode,
      pairingCode,
    };
  } catch (error) {
    logger.warn(
      { errorName: errorName(error), timeoutMs: CONNECTION_ACTION_TIMEOUT_MS },
      "[Evolution] Falha ao iniciar a conexão do WhatsApp",
    );
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

export const disconnectEvolutionInstance = async () => {
  const config = await getEvolutionConfig();
  if (!config || !config.instance) {
    return {
      disconnected: false,
      instance: "",
      message: "Nenhuma conexão do WhatsApp está selecionada",
    };
  }

  const instance = config.instance;
  try {
    const response = await fetch(
      `${config.baseUrl}/instance/logout/${encodeURIComponent(instance)}`,
      {
        method: "DELETE",
        headers: { apikey: config.apiKey },
        signal: AbortSignal.timeout(CONNECTION_ACTION_TIMEOUT_MS),
      },
    );
    if (!response.ok) {
      const providerError = getEvolutionErrorDetails(await parseEvolutionResponseBody(response));
      logger.warn(
        { status: response.status, ...providerError },
        "[Evolution] A solicitação de desconexão não foi aceita",
      );
      const connection = await getEvolutionConnection({ configureWebhook: false });
      if (["close", "closed", "disconnected", "offline", "instance_not_found"].includes(connection.state.toLowerCase())) {
        await evolutionInstanceStore.setSelectedInstance(null);
        configuredWebhookInstance = null;
        return {
          disconnected: true,
          instance,
          message: "A instância já estava desconectada. Gere um novo QR Code para conectar outro número.",
        };
      }
      return {
        disconnected: false,
        instance,
        message: `Não foi possível desconectar o WhatsApp (HTTP ${response.status}${providerError.providerCode ? ` · ${providerError.providerCode}` : ""})`,
      };
    }

    await evolutionInstanceStore.setSelectedInstance(null);
    configuredWebhookInstance = null;
    return {
      disconnected: true,
      instance,
      message: "WhatsApp desconectado. Gere um novo QR Code para conectar outro número.",
    };
  } catch (error) {
    logger.warn(
      { errorName: errorName(error), timeoutMs: CONNECTION_ACTION_TIMEOUT_MS },
      "[Evolution] Falha ao desconectar o WhatsApp",
    );
    return {
      disconnected: false,
      instance,
      message: "Não foi possível desconectar o WhatsApp",
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
  replyTo?: EvolutionReplyReference,
): Promise<EvolutionSendResult> => {
  const config = await getEvolutionConfig();
  if (!config || !config.instance) {
    return { ok: false, providerMessageId: null, error: "Evolution API não configurada" };
  }

  try {
    const url = `${config.baseUrl}/message/sendText/${encodeURIComponent(config.instance)}`;
    let quoteFallbackAttempted = false;
    const response = await sendTextWithQuoteFallback((includeQuote) => {
      if (replyTo && !includeQuote) quoteFallbackAttempted = true;
      return fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        body: JSON.stringify({
          number: normalizeWhatsappPhone(phone),
          text,
          ...(replyTo && includeQuote
            ? {
                quoted: {
                  key: {
                    remoteJid: replyTo.remoteJid,
                    fromMe: replyTo.fromMe,
                    id: replyTo.id,
                  },
                  message: replyTo.message,
                },
              }
            : {}),
        }),
      });
    }, Boolean(replyTo));
    if (quoteFallbackAttempted) {
      logger.warn(
        { instance: config.instance },
        "[Evolution] A resposta citada foi rejeitada; reenvio sem citação",
      );
    }
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const providerError = typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
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

export const sendEvolutionReaction = async (
  phone: string,
  providerMessageId: string,
  reaction = "❤️",
): Promise<EvolutionSendResult> => {
  const config = await getEvolutionConfig();
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
  replyTo?: EvolutionReplyReference,
): Promise<EvolutionSendResult> => {
  const config = await getEvolutionConfig();
  if (!config || !config.instance) {
    return { ok: false, providerMessageId: null, error: "WhatsApp não configurado" };
  }

  try {
    const file = documentFiles[document];
    const media = (await readWhatsappAsset(file.path)).toString("base64");
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
          ...(replyTo
            ? {
                quoted: {
                  key: {
                    remoteJid: replyTo.remoteJid,
                    fromMe: replyTo.fromMe,
                    id: replyTo.id,
                  },
                  message: replyTo.message,
                },
              }
            : {}),
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

const sendEvolutionImage = async (
  phone: string,
  imageFile: { path: string; fileName: string },
  caption: string,
  replyTo?: EvolutionReplyReference,
): Promise<EvolutionSendResult> => {
  const config = await getEvolutionConfig();
  if (!config || !config.instance) {
    return { ok: false, providerMessageId: null, error: "WhatsApp não configurado" };
  }

  try {
    const media = (await readWhatsappAsset(imageFile.path)).toString("base64");
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
          mediatype: "image",
          mimetype: "image/jpeg",
          caption,
          media,
          fileName: imageFile.fileName,
          ...(replyTo
            ? {
                quoted: {
                  key: {
                    remoteJid: replyTo.remoteJid,
                    fromMe: replyTo.fromMe,
                    id: replyTo.id,
                  },
                  message: replyTo.message,
                },
              }
            : {}),
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
      error: error instanceof Error ? error.message : "Falha ao enviar a imagem pelo WhatsApp",
    };
  }
};

export const sendEvolutionSessionPreparationImage = (
  phone: string,
  caption: string,
): Promise<EvolutionSendResult> =>
  sendEvolutionImage(phone, sessionPreparationImageFile, caption);

export const sendEvolutionDapImage = (
  phone: string,
  image: WhatsappDapImage,
  caption: string,
): Promise<EvolutionSendResult> =>
  sendEvolutionImage(phone, dapImageFiles[image], caption);

export const sendEvolutionBathMoonBanner = (
  phone: string,
  image: WhatsappBathMoonBannerImage,
  caption: string,
): Promise<EvolutionSendResult> =>
  sendEvolutionImage(phone, bathMoonBannerFiles[image], caption);

export const sendEvolutionBronzeBanner = (
  phone: string,
  image: WhatsappBronzeBannerImage,
  caption: string,
): Promise<EvolutionSendResult> =>
  sendEvolutionImage(phone, bronzeBannerFiles[image], caption);

export const sendEvolutionAudio = async (
  phone: string,
  clip: WhatsappAudioClip,
): Promise<EvolutionSendResult> => {
  const config = await getEvolutionConfig();
  if (!config || !config.instance) {
    return { ok: false, providerMessageId: null, error: "WhatsApp não configurado" };
  }

  try {
    const audio = (await readWhatsappAsset(audioFiles[clip].path)).toString("base64");
    const response = await fetch(
      `${config.baseUrl}/message/sendWhatsAppAudio/${encodeURIComponent(config.instance)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.apiKey,
        },
        signal: AbortSignal.timeout(VOICE_NOTE_SEND_TIMEOUT_MS),
        body: JSON.stringify({
          number: normalizeWhatsappPhone(phone),
          audio,
          encoding: true,
          delay: VOICE_NOTE_RECORDING_DELAY_MS,
        }),
      },
    );
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const providerError = typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
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
      error: error instanceof Error ? error.message : "Falha ao enviar o áudio pelo WhatsApp",
    };
  }
};

export type EvolutionMedia = {
  buffer: Buffer;
  mimetype: string;
};

const decodeBase64Media = (value: string, fallbackMimetype: string) => {
  const match = value.match(/^data:([^;]+);base64,(.*)$/s);
  return {
    buffer: Buffer.from(match?.[2] ?? value, "base64"),
    mimetype: match?.[1] ?? fallbackMimetype,
  };
};

const unwrapEvolutionMessage = (message: Record<string, unknown>) => {
  let current = message;
  for (let index = 0; index < 4; index += 1) {
    const nested = ["ephemeralMessage", "viewOnceMessage", "viewOnceMessageV2"]
      .map((key) => current[key] as Record<string, unknown> | undefined)
      .find((value) => value?.message && typeof value.message === "object");
    if (!nested) break;
    current = nested.message as Record<string, unknown>;
  }
  return current;
};

export const getEvolutionMedia = async (
  key: Record<string, unknown>,
  message: Record<string, unknown>,
  mediaType: "audio" | "image",
): Promise<EvolutionMedia> => {
  const config = await getEvolutionConfig();
  if (!config || !config.instance) throw new Error("Evolution API não configurada");

  const contentMessage = unwrapEvolutionMessage(message);
  const mediaMessage = (
    contentMessage[`${mediaType}Message`] ??
    (mediaType === "audio" ? contentMessage["pttMessage"] : undefined)
  ) as Record<string, unknown> | undefined;
  const mimetype = typeof mediaMessage?.mimetype === "string"
    ? mediaMessage.mimetype.split(";")[0]
    : mediaType === "audio" ? "audio/ogg" : "image/jpeg";
  const inlineBase64 = [mediaMessage?.base64, contentMessage.base64, message.base64]
    .find((value): value is string => typeof value === "string" && value.length > 0);
  if (inlineBase64) return decodeBase64Media(inlineBase64, mimetype);

  const response = await fetch(
    `${config.baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(config.instance)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: config.apiKey,
      },
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      body: JSON.stringify({
        message: { key, message },
        convertToMp4: false,
      }),
    },
  );
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  const nestedData = body.data as Record<string, unknown> | undefined;
  const nestedResult = body.result as Record<string, unknown> | undefined;
  const base64 = [
    body.base64,
    body.data,
    body.media,
    nestedData?.base64,
    nestedData?.data,
    nestedData?.media,
    nestedResult?.base64,
    nestedResult?.data,
  ].find((value): value is string => typeof value === "string" && value.length > 0) ?? null;
  const responseMimetype = [
    body.mimetype,
    body.mimeType,
    nestedData?.mimetype,
    nestedData?.mimeType,
    nestedResult?.mimetype,
    nestedResult?.mimeType,
  ].find((value): value is string => typeof value === "string" && value.length > 0);
  if (!response.ok || !base64) {
    throw new Error(`Não foi possível baixar a mídia do WhatsApp (HTTP ${response.status})`);
  }
  return decodeBase64Media(base64, responseMimetype?.split(";")[0] ?? mimetype);
};

export const getEvolutionConnection = async ({
  configureWebhook = true,
}: {
  configureWebhook?: boolean;
} = {}) => {
  const config = await getEvolutionConfig();
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
    const responseBody = await parseEvolutionResponseBody(response);
    const body = responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)
      ? responseBody as Record<string, unknown>
      : {};
    const providerError = response.ok ? {} : getEvolutionErrorDetails(responseBody);
    if (!response.ok) {
      logger.warn(
        { status: response.status, ...providerError },
        "[Evolution] Não foi possível consultar o status da conexão",
      );
    }
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
        const connected = ["open", "connected"].includes(state.toLowerCase());
        const webhookReady =
          connected && configureWebhook
            ? await configureEvolutionWebhook(config.instance)
            : null;
        return {
          configured: true,
          connected,
          instance: config.instance,
          state,
          message: connected && webhookReady === false
            ? "WhatsApp conectado, mas o webhook de mensagens não está configurado. A IA não receberá novas mensagens."
            : `Status do WhatsApp: ${state}`,
        };
      }
    }
    const state = String(
      (body.instance as Record<string, unknown> | undefined)?.state ??
      body.state ??
      (response.ok ? "unknown" : `http_${response.status}`),
    );
    const connected = response.ok && ["open", "connected"].includes(state.toLowerCase());
    const errorContext = ` (HTTP ${response.status}${providerError.providerCode ? ` · ${providerError.providerCode}` : ""})`;
    const webhookReady =
      connected && configureWebhook
        ? await configureEvolutionWebhook(config.instance)
        : null;
    return {
      configured: true,
      connected,
      instance: config.instance,
      state,
      message: connected
        ? webhookReady === false
          ? "WhatsApp conectado, mas o webhook de mensagens não está configurado. A IA não receberá novas mensagens."
          : "WhatsApp conectado"
        : response.ok && ["connecting", "qr_pending", "created"].includes(state.toLowerCase())
          ? "Aguardando leitura do QR Code"
        : response.status === 401 || response.status === 403
          ? `Não foi possível autenticar a conexão do WhatsApp${errorContext}`
          : `Não foi possível consultar o status do WhatsApp${errorContext}`,
    };
  } catch (error) {
    logger.warn(
      { errorName: errorName(error), timeoutMs: PROVIDER_TIMEOUT_MS },
      "[Evolution] Falha ao consultar o status da conexão",
    );
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
  const config = await getEvolutionConfig();
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