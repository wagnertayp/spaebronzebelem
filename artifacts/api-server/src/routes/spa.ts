import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CreateAppointmentBody,
  CreateAppointmentResponse,
  CreateClientBody,
  CreateClientResponse,
  CreateInventoryItemBody,
  CreateInventoryItemResponse,
  CreateFinancialMovementBody,
  CreateFinancialMovementResponse,
  CreateLeadBody,
  CreateLeadResponse,
  CreateQuoteBody,
  CreateQuoteResponse,
  CreateProfessionalBody,
  CreateProfessionalResponse,
  CreateServiceBody,
  CreateServiceResponse,
  DeleteAppointmentParams,
  DeleteClientParams,
  DeleteInventoryItemParams,
  DeleteFinancialMovementParams,
  DeleteQuoteParams,
  DeleteProfessionalParams,
  DeleteServiceParams,
  GetDashboardResponse,
  GetFinanceSummaryResponse,
  GetAiAgentConfigResponse,
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  ListClientsQueryParams,
  ListClientsResponse,
  ListInventoryQueryParams,
  ListInventoryResponse,
  ListFinancialMovementsQueryParams,
  ListFinancialMovementsResponse,
  ListLeadsResponse,
  ListQuotesResponse,
  ListQuotesQueryParams,
  SendQuoteParams,
  GetPublicQuoteParams,
  ApprovePublicQuoteParams,
  CancelQuoteParams,
  DuplicateQuoteParams,
  CreateQuoteAppointmentParams,
  CreateQuoteAppointmentBody,
  CreateQuotePaymentParams,
  CreateQuotePaymentBody,
  ListProfessionalsResponse,
  ListServicesResponse,
  UpdateLeadBody,
  UpdateLeadParams,
  UpdateLeadResponse,
  UpdateAppointmentBody,
  UpdateAppointmentParams,
  UpdateAppointmentResponse,
  UpdateClientBody,
  UpdateClientParams,
  UpdateClientResponse,
  UpdateInventoryItemBody,
  UpdateInventoryItemParams,
  UpdateInventoryItemResponse,
  UpdateFinancialMovementBody,
  UpdateFinancialMovementParams,
  UpdateFinancialMovementResponse,
  UpdateQuoteBody,
  UpdateQuoteParams,
  UpdateQuoteResponse,
  UpdateProfessionalBody,
  UpdateProfessionalParams,
  UpdateProfessionalResponse,
  UpdateServiceBody,
  UpdateServiceParams,
  UpdateServiceResponse,
  UpdateAiAgentConfigBody,
  UpdateAiAgentConfigResponse,
  TestAiAgentBody,
  TestAiAgentResponse,
  GetWhatsappConnectionResponse,
  ConnectWhatsappResponse,
  DisconnectWhatsappResponse,
  GetWhatsappAutomationResponse,
  UpdateWhatsappAutomationBody,
  UpdateWhatsappAutomationResponse,
  ListWhatsappMessagesQueryParams,
  ListWhatsappMessagesResponse,
  ListWhatsappConversationsQueryParams,
  ListWhatsappConversationsResponse,
  UpdateWhatsappConversationParams,
  UpdateWhatsappConversationBody,
  UpdateWhatsappConversationResponse,
  DeleteWhatsappConversationParams,
  SendWhatsappAppointmentConfirmationResponse,
  SendWhatsappReplyBody,
  SendWhatsappReplyResponse,
  SendWhatsappDocumentBody,
  SendWhatsappDocumentResponse,
  ReceiveEvolutionWebhookBody,
  ReceiveEvolutionWebhookResponse,
  GetProfessionalCommissionConfigParams,
  GetProfessionalCommissionConfigResponse,
  UpdateProfessionalCommissionConfigParams,
  UpdateProfessionalCommissionConfigBody,
  UpdateProfessionalCommissionConfigResponse,
  ListCommissionRulesParams,
  ListCommissionRulesResponse,
  CreateCommissionRuleParams,
  CreateCommissionRuleBody,
  CreateCommissionRuleResponse,
  UpdateCommissionRuleParams,
  UpdateCommissionRuleBody,
  UpdateCommissionRuleResponse,
  DeleteCommissionRuleParams,
  GetCommissionsSummaryQueryParams,
  GetCommissionsSummaryResponse,
  ListCommissionItemsQueryParams,
  ListCommissionItemsResponse,
  GetCommissionItemParams,
  GetCommissionItemResponse,
  ListCommissionClosuresQueryParams,
  ListCommissionClosuresResponse,
  CloseCommissionPeriodBody,
  CloseCommissionPeriodResponse,
  ReopenCommissionPeriodParams,
  ReopenCommissionPeriodResponse,
  PayCommissionPeriodParams,
  PayCommissionPeriodBody,
  PayCommissionPeriodResponse,
  ListCommissionAuditQueryParams,
  ListCommissionAuditResponse,
} from "@workspace/api-zod";
import {
  db,
  whatsappConversationsTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
} from "@workspace/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ensureCompatibleFormat, speechToText } from "@workspace/integrations-openai-ai-server/audio";
import backup from "../data/spa-backup.json";
import { logger } from "../lib/logger";
import { requireSession } from "../lib/auth";
import {
  getEvolutionConfig,
  connectEvolutionInstance,
  disconnectEvolutionInstance,
  getEvolutionConnection,
  configureEvolutionWebhook,
  normalizeWhatsappPhone,
  sendEvolutionReaction,
  sendEvolutionDocument,
  getEvolutionMedia,
  sendEvolutionAudio,
  sendEvolutionSessionPreparationImage,
  type EvolutionReplyReference,
  type WhatsappAudioClip,
  sendEvolutionText,
  type WhatsappDocument,
} from "../lib/evolution";

const router: IRouter = Router();

// All operational data is private; quote links remain public by design.
router.use((req, res, next) => {
  if (req.path.startsWith("/public/") || req.path === "/integrations/evolution/webhook") return next();
  return requireSession(req, res, next);
});

type AppointmentStatus =
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

type LeadStage =
  | "new"
  | "contacting"
  | "quote"
  | "scheduled"
  | "converted"
  | "lost";

type Appointment = {
  id: number;
  start: string;
  end: string;
  client: string;
  service: string;
  professional: string;
  room: string;
  status: AppointmentStatus;
  avatar: string;
};

type WhatsappMessage = ReturnType<typeof ListWhatsappMessagesResponse.parse>[number];
type WhatsappAutomation = ReturnType<typeof GetWhatsappAutomationResponse.parse>;
type WhatsappConversation = ReturnType<typeof ListWhatsappConversationsResponse.parse>[number];
type WhatsappConversationStatus = WhatsappConversation["status"];
const FIRST_WHATSAPP_MESSAGE_DELAY_MS = 8_000;
const OPENAI_TEXT_MODEL = process.env["OPENAI_API_KEY"] ? "gpt-5.4" : "gpt-5.6-luna";
const WHATSAPP_REACTIONS = ["🤎", "❤️", "🧡", "💛", "👍", "😊"] as const;
const processingWhatsappWebhookMessageIds = new Set<string>();

const reactionForWhatsappMessage = (providerMessageId: string, text: string) => {
  const source = `${providerMessageId}:${text}`;
  const score = Array.from(source).reduce((total, character) => total + character.codePointAt(0)!, 0);
  return WHATSAPP_REACTIONS[score % WHATSAPP_REACTIONS.length];
};

const audioClipForWhatsappMessage = (normalizedText: string): WhatsappAudioClip | null => {
  if (/\b(combos?|pacotes?|combinacoes?)\b/.test(normalizedText)) return "combos";
  if (/\b(bronze(?:amento|adas?)?|marquinhas?)\b/.test(normalizedText)) return "bronze";
  return null;
};

const unwrapWhatsappMessage = (message: Record<string, unknown>) => {
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

type Lead = {
  id: number;
  name: string;
  initials: string;
  phone: string;
  source: string;
  service: string;
  stage: LeadStage;
  lastMessage: string;
  time: string;
  value: string;
};

type Professional = ReturnType<typeof ListProfessionalsResponse.parse>[number];
type FinancialMovement = ReturnType<typeof ListFinancialMovementsResponse.parse>[number];

const appointments: Appointment[] = [
  {
    id: 1,
    start: "09:00",
    end: "10:00",
    client: "Ana Martins",
    service: "Massagem Relaxante",
    professional: "Marina",
    room: "Sala 02",
    status: "in_progress",
    avatar: "AM",
  },
  {
    id: 2,
    start: "10:30",
    end: "11:20",
    client: "Mariana Costa",
    service: "Drenagem Linfática",
    professional: "Paula",
    room: "Sala 01",
    status: "confirmed",
    avatar: "MC",
  },
  {
    id: 3,
    start: "11:30",
    end: "12:45",
    client: "Juliana Alves",
    service: "Ritual Facial",
    professional: "Rosana",
    room: "Sala 03",
    status: "confirmed",
    avatar: "JA",
  },
  {
    id: 4,
    start: "14:00",
    end: "15:00",
    client: "Carlos Almeida",
    service: "Massagem Terapêutica",
    professional: "Wallace",
    room: "Sala 02",
    status: "confirmed",
    avatar: "CA",
  },
  {
    id: 5,
    start: "15:30",
    end: "16:10",
    client: "Beatriz Lima",
    service: "Bronzeamento em máquina",
    professional: "Paula",
    room: "Bronze 01",
    status: "confirmed",
    avatar: "BL",
  },
];

const professionals: Professional[] = [
  { id: 1, name: "Marina", specialty: "Massagens e terapias", phone: "", email: "", commissionRate: 20, active: true },
  { id: 2, name: "Paula", specialty: "Drenagem e tratamentos corporais", phone: "", email: "", commissionRate: 18, active: true },
  { id: 3, name: "Rosana", specialty: "Estética facial", phone: "", email: "", commissionRate: 20, active: true },
  { id: 4, name: "Wallace", specialty: "Massoterapia", phone: "", email: "", commissionRate: 15, active: true },
];

type CommissionConfig = {
  professionalId: number;
  commissionType: "percent" | "fixed";
  defaultValue: number;
  calculationBase: "gross" | "net" | "paid";
  discountInCalculation: boolean;
  cardFeeInCalculation: boolean;
  cancellationsGenerate: boolean;
  productsGenerate: boolean;
  productCommissionPercent: number;
  updatedAt: string;
};
type CommissionRule = {
  id: number;
  professionalId: number;
  serviceId: number;
  serviceName: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
};
type CommissionItem = {
  id: number;
  appointmentId: number;
  professionalId: number | null;
  professionalName: string;
  serviceId: number | null;
  serviceName: string;
  date: string | null;
  status: "eligible" | "blocked" | "closed" | "paid";
  blockedReason: string | null;
  baseAmount: number | null;
  rateType: "percent" | "fixed";
  rateValue: number | null;
  commissionAmount: number | null;
  calculationBase: "gross" | "net" | "paid";
  snapshot: Record<string, unknown>;
};
type CommissionClosure = {
  id: number;
  professionalId: number;
  professionalName: string;
  from: string;
  to: string;
  dueDate: string;
  status: "open" | "closed" | "paid";
  totalAmount: number;
  itemIds: number[];
  itemSnapshots: CommissionItem[];
  financialMovementId: number | null;
  closedAt: string | null;
  paidAt: string | null;
  paymentDate: string | null;
  paymentMethod: string | null;
  paymentNote: string | null;
};
type CommissionAudit = {
  id: number;
  action: "config" | "close" | "reopen" | "pay";
  professionalId: number;
  closureId: number | null;
  username: string;
  timestamp: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

const commissionConfigs = new Map<number, CommissionConfig>(
  professionals.map((professional) => [
    professional.id,
    {
      professionalId: professional.id,
      commissionType: "percent",
      defaultValue: professional.commissionRate,
      calculationBase: "gross",
      discountInCalculation: false,
      cardFeeInCalculation: false,
      cancellationsGenerate: false,
      productsGenerate: false,
      productCommissionPercent: 0,
      updatedAt: new Date().toISOString(),
    },
  ]),
);
const commissionRules: CommissionRule[] = [];
const commissionClosures: CommissionClosure[] = [];
const commissionAudit: CommissionAudit[] = [];

const financialMovements: FinancialMovement[] = [
  { id: 1, type: "revenue", date: "2026-09-02", description: "Massagens", category: "Serviços", amount: 16400, status: "paid", client: "", service: "Massagem", professional: "Ana" },
  { id: 2, type: "revenue", date: "2026-09-05", description: "Drenagens", category: "Serviços", amount: 12780, status: "paid", client: "", service: "Drenagem", professional: "Carla" },
  { id: 3, type: "revenue", date: "2026-09-08", description: "Day Spa", category: "Serviços", amount: 10750, status: "paid", client: "", service: "Day Spa", professional: "Juliana" },
  { id: 4, type: "revenue", date: "2026-09-12", description: "Bronzeamentos", category: "Serviços", amount: 15320, status: "paid", client: "", service: "Bronzeamento", professional: "Ana" },
  { id: 5, type: "revenue", date: "2026-09-18", description: "Estética facial", category: "Serviços", amount: 13800, status: "paid", client: "", service: "Estética facial", professional: "Carla" },
  { id: 6, type: "revenue", date: "2026-09-24", description: "Tratamentos corporais", category: "Serviços", amount: 18400, status: "paid", client: "", service: "Corporal", professional: "Juliana" },
  { id: 7, type: "expense", date: "2026-09-05", description: "Comissões da equipe", category: "Comissões", amount: 12850, status: "paid", client: "", service: "", professional: "" },
  { id: 8, type: "expense", date: "2026-09-09", description: "Compra de produtos", category: "Produtos", amount: 6400, status: "paid", client: "", service: "", professional: "" },
  { id: 9, type: "expense", date: "2026-09-10", description: "Aluguel", category: "Aluguel", amount: 5000, status: "paid", client: "", service: "", professional: "" },
  { id: 10, type: "expense", date: "2026-09-14", description: "Anúncios e divulgação", category: "Marketing", amount: 3200, status: "paid", client: "", service: "", professional: "" },
  { id: 11, type: "expense", date: "2026-09-20", description: "Energia elétrica", category: "Energia", amount: 1830, status: "paid", client: "", service: "", professional: "" },
  { id: 12, type: "expense", date: "2026-09-26", description: "Outras despesas", category: "Outros", amount: 2000, status: "paid", client: "", service: "", professional: "" },
  { id: 13, type: "receivable", date: "2026-09-03", description: "Pagamento pendente", category: "Clientes", amount: 450, status: "pending", client: "Maria", service: "Massagem", professional: "Ana" },
  { id: 14, type: "receivable", date: "2026-09-06", description: "Pagamento pendente", category: "Clientes", amount: 1200, status: "pending", client: "Ana", service: "Day Spa", professional: "Juliana" },
  { id: 15, type: "receivable", date: "2026-09-08", description: "Pagamento pendente", category: "Clientes", amount: 280, status: "pending", client: "Carla", service: "Drenagem", professional: "Carla" },
  { id: 16, type: "receivable", date: "2026-09-11", description: "Pagamento pendente", category: "Clientes", amount: 890, status: "pending", client: "Beatriz", service: "Estética facial", professional: "Carla" },
  { id: 17, type: "receivable", date: "2026-09-13", description: "Pagamento pendente", category: "Clientes", amount: 1350, status: "pending", client: "Luana", service: "Day Spa", professional: "Juliana" },
  { id: 18, type: "receivable", date: "2026-09-16", description: "Pagamento pendente", category: "Clientes", amount: 720, status: "pending", client: "Patrícia", service: "Massagem", professional: "Ana" },
  { id: 19, type: "receivable", date: "2026-09-19", description: "Pagamento pendente", category: "Clientes", amount: 980, status: "pending", client: "Fernanda", service: "Corporal", professional: "Juliana" },
  { id: 20, type: "receivable", date: "2026-09-22", description: "Pagamento pendente", category: "Clientes", amount: 1100, status: "pending", client: "Camila", service: "Bronzeamento", professional: "Ana" },
  { id: 21, type: "receivable", date: "2026-09-25", description: "Pagamento pendente", category: "Clientes", amount: 650, status: "pending", client: "Juliana", service: "Drenagem", professional: "Carla" },
  { id: 22, type: "receivable", date: "2026-09-28", description: "Pagamento pendente", category: "Clientes", amount: 800, status: "pending", client: "Renata", service: "Estética facial", professional: "Carla" },
];

const clients = backup.clients.map((client) => ({
  id: client.id,
  name: client.name,
  initials: client.initials,
  lastVisit: client.lastVisit,
  service: client.service,
  status: client.status as "active" | "at_risk" | "new",
  source: client.source,
  phone: String((client as { phone?: unknown }).phone ?? ""),
  email: String((client as { email?: unknown }).email ?? ""),
  notes: String((client as { notes?: unknown }).notes ?? ""),
}));

let whatsappAutomation: WhatsappAutomation = {
  enabled: false,
  aiReplies: false,
  humanSupervision: true,
  confirmations: true,
  reminder24h: true,
  reminder2h: true,
  timezone: process.env["EVOLUTION_TIMEZONE"] ?? "America/Belem",
};

const WHATSAPP_SETTINGS_ID = 1;

const loadWhatsappSettings = async () => {
  const [settings] = await db
    .select()
    .from(whatsappSettingsTable)
    .where(eq(whatsappSettingsTable.id, WHATSAPP_SETTINGS_ID))
    .limit(1);
  if (!settings) return;

  const savedAgentConfig = GetAiAgentConfigResponse.safeParse(settings.aiAgentConfig);
  if (savedAgentConfig.success) {
    aiAgentConfig = {
      ...savedAgentConfig.data,
      humanHandoff: "Só encaminhe para uma atendente se a cliente pedir explicitamente uma pessoa ou atendimento humano.",
    };
  }

  const savedAutomation = GetWhatsappAutomationResponse.safeParse(settings.whatsappAutomation);
  if (savedAutomation.success) whatsappAutomation = savedAutomation.data;
};

const saveWhatsappSettings = async () => {
  await db
    .insert(whatsappSettingsTable)
    .values({
      id: WHATSAPP_SETTINGS_ID,
      aiAgentConfig,
      whatsappAutomation,
    })
    .onConflictDoUpdate({
      target: whatsappSettingsTable.id,
      set: {
        aiAgentConfig,
        whatsappAutomation,
        updatedAt: new Date(),
      },
    });
};
const normalizeName = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
const findClientForAppointment = (appointment: Appointment) =>
  clients.find((client) => normalizeName(client.name) === normalizeName(appointment.client));

const appointmentDateTime = (start: string): Date | null => {
  if (/^\d{4}-\d{2}-\d{2}(?:T|\s)/.test(start)) {
    const parsed = new Date(start);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const localAgendaDate = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: whatsappAutomation.timezone }).format(new Date());

const appointmentDateTimeInAgenda = (start: string, agendaDate = localAgendaDate()): Date | null => {
  const parsed = appointmentDateTime(start);
  if (parsed) return parsed;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(start)) return null;
  const time = start.length === 5 ? `${start}:00` : start;
  const legacyDateTime = new Date(`${agendaDate}T${time}`);
  return Number.isNaN(legacyDateTime.getTime()) ? null : legacyDateTime;
};

const formatAppointmentDate = (appointment: Appointment) => {
  const date = appointmentDateTime(appointment.start);
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: whatsappAutomation.timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
};

const toWhatsappMessage = (message: typeof whatsappMessagesTable.$inferSelect): WhatsappMessage => ({
  id: message.id,
  direction: message.direction as WhatsappMessage["direction"],
  phone: message.phone,
  clientName: message.clientName,
  appointmentId: message.appointmentId,
  text: message.text,
  status: message.status as WhatsappMessage["status"],
  kind: message.kind as WhatsappMessage["kind"],
  providerMessageId: message.providerMessageId,
  error: message.error,
  createdAt: message.createdAt.toISOString(),
});

const getWhatsappConversation = async (phone: string) => {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const [existing] = await db
    .select()
    .from(whatsappConversationsTable)
    .where(eq(whatsappConversationsTable.phone, normalizedPhone))
    .limit(1);
  return existing ?? null;
};

const ensureWhatsappConversation = async (phone: string, clientName: string) => {
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const existing = await getWhatsappConversation(normalizedPhone);
  if (existing) {
    if (clientName && clientName !== existing.clientName && clientName !== normalizedPhone) {
      const [updated] = await db
        .update(whatsappConversationsTable)
        .set({ clientName, updatedAt: new Date() })
        .where(eq(whatsappConversationsTable.id, existing.id))
        .returning();
      return updated ?? existing;
    }
    return existing;
  }
  const [created] = await db
    .insert(whatsappConversationsTable)
    .values({ phone: normalizedPhone, clientName: clientName || normalizedPhone })
    .onConflictDoNothing({ target: whatsappConversationsTable.phone })
    .returning();
  return created ?? (await getWhatsappConversation(normalizedPhone))!;
};

const setWhatsappConversationStatus = async (phone: string, status: WhatsappConversationStatus) => {
  const conversation = await ensureWhatsappConversation(phone, phone);
  const [updated] = await db
    .update(whatsappConversationsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(whatsappConversationsTable.id, conversation.id))
    .returning();
  return updated ?? conversation;
};

const addWhatsappMessage = async (message: Omit<WhatsappMessage, "id" | "createdAt">) => {
  const conversation = await ensureWhatsappConversation(message.phone, message.clientName);
  const [created] = await db
    .insert(whatsappMessagesTable)
    .values({
      conversationId: conversation.id,
      direction: message.direction,
      phone: message.phone,
      clientName: message.clientName,
      appointmentId: message.appointmentId,
      text: message.text,
      status: message.status,
      kind: message.kind,
      providerMessageId: message.providerMessageId,
      error: message.error,
    })
    .returning();
  if (!created) throw new Error("Não foi possível salvar a mensagem do WhatsApp");
  await db
    .update(whatsappConversationsTable)
    .set({
      clientName: message.clientName || conversation.clientName,
      lastMessageAt: created.createdAt,
      updatedAt: new Date(),
    })
    .where(eq(whatsappConversationsTable.id, conversation.id));
  return toWhatsappMessage(created);
};

const updateWhatsappMessage = async (id: number, changes: Pick<WhatsappMessage, "status" | "providerMessageId" | "error">) => {
  const [updated] = await db
    .update(whatsappMessagesTable)
    .set(changes)
    .where(eq(whatsappMessagesTable.id, id))
    .returning();
  return updated ? toWhatsappMessage(updated) : null;
};

const toWhatsappConversation = async (
  conversation: typeof whatsappConversationsTable.$inferSelect,
): Promise<WhatsappConversation> => {
  const [latest] = await db
    .select({ text: whatsappMessagesTable.text })
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.conversationId, conversation.id))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(1);
  const [count] = await db
    .select({ value: sql<number>`count(*)` })
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.conversationId, conversation.id));
  return {
    id: conversation.id,
    phone: conversation.phone,
    clientName: conversation.clientName,
    status: conversation.status as WhatsappConversationStatus,
    lastMessage: latest?.text ?? "",
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    messageCount: Number(count?.value ?? 0),
  };
};

const getWhatsappConversationSummary = async (phone: string) => {
  const conversation = await getWhatsappConversation(phone);
  return conversation ? toWhatsappConversation(conversation) : null;
};

const appointmentMessageText = (
  appointment: Appointment,
  kind: WhatsappMessage["kind"],
) => {
  const formattedDate = formatAppointmentDate(appointment);
  if (!formattedDate) return null;
  if (kind === "confirmation") {
    return `Olá, ${appointment.client}! Seu atendimento no Spa e Bronze Belém está reservado para ${formattedDate}, com ${appointment.professional}, para ${appointment.service}. Responda CONFIRMAR para confirmar, REMARCAR para escolher outro horário ou CANCELAR para cancelar.`;
  }
  if (kind === "reminder24h") {
    return `Olá, ${appointment.client}! Lembrando que seu atendimento será amanhã: ${formattedDate}, com ${appointment.professional}, para ${appointment.service}. Responda CONFIRMAR para confirmar sua presença.`;
  }
  return `Olá, ${appointment.client}! Seu atendimento começa em aproximadamente 2 horas: ${formattedDate}, com ${appointment.professional}, para ${appointment.service}. Estamos esperando você.`;
};

const sendAppointmentMessage = async (
  appointment: Appointment,
  kind: Extract<WhatsappMessage["kind"], "confirmation" | "reminder24h" | "reminder2h">,
) => {
  const client = findClientForAppointment(appointment);
  const phone = client ? normalizeWhatsappPhone(client.phone) : "";
  const text = appointmentMessageText(appointment, kind);
  const [existing] = await db
    .select()
    .from(whatsappMessagesTable)
    .where(and(
      eq(whatsappMessagesTable.appointmentId, appointment.id),
      eq(whatsappMessagesTable.kind, kind),
      inArray(whatsappMessagesTable.status, ["sent", "delivered"]),
    ))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(1);
  if (existing) {
    if (kind === "confirmation" && client && phone) {
      await sendWhatsappSessionPreparationImage(appointment, phone, client.name);
    }
    return toWhatsappMessage(existing);
  }

  if (!client || !phone || !text) {
    return await addWhatsappMessage({
      direction: "outbound",
      phone,
      clientName: appointment.client,
      appointmentId: appointment.id,
      text: text ?? "Mensagem não enviada porque o agendamento não possui data completa.",
      status: "skipped",
      kind,
      providerMessageId: null,
      error: !client || !phone ? "Cliente sem telefone cadastrado" : "Agendamento sem data completa",
    });
  }

  const pending = await addWhatsappMessage({
    direction: "outbound",
    phone,
    clientName: appointment.client,
    appointmentId: appointment.id,
    text,
    status: "pending",
    kind,
    providerMessageId: null,
    error: null,
  });
  const result = await sendEvolutionText(phone, text);
  const updated = (await updateWhatsappMessage(pending.id, {
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
    error: result.error,
  })) ?? pending;
  if (kind === "confirmation") {
    await sendWhatsappSessionPreparationImage(appointment, phone, client.name);
  }
  return updated;
};

const sendWhatsappReply = async (
  phone: string,
  clientName: string,
  appointmentId: number | null,
  text: string,
  kind: Extract<WhatsappMessage["kind"], "reply" | "handoff"> = "reply",
  replyTo?: EvolutionReplyReference,
) => {
  const item = await addWhatsappMessage({
    direction: "outbound",
    phone: normalizeWhatsappPhone(phone),
    clientName,
    appointmentId,
    text,
    status: "pending",
    kind,
    providerMessageId: null,
    error: null,
  });
  const result = await sendEvolutionText(phone, text, replyTo);
  return (await updateWhatsappMessage(item.id, {
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
    error: result.error,
  })) ?? item;
};

const sendWhatsappDocumentMessage = async (
  phone: string,
  clientName: string,
  document: WhatsappDocument,
  caption: string,
  appointmentId: number | null = null,
  replyTo?: EvolutionReplyReference,
) => {
  const item = await addWhatsappMessage({
    direction: "outbound",
    phone: normalizeWhatsappPhone(phone),
    clientName,
    appointmentId,
    text: caption,
    status: "pending",
    kind: "document",
    providerMessageId: null,
    error: null,
  });
  const result = await sendEvolutionDocument(phone, document, caption, replyTo);
  return (await updateWhatsappMessage(item.id, {
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
    error: result.error,
  })) ?? item;
};

const sendWhatsappSessionPreparationImage = async (
  appointment: Appointment,
  phone: string,
  clientName: string,
) => {
  const service = serviceForAppointment(appointment);
  const serviceLabel = normalizeName(`${appointment.service} ${service?.category ?? ""}`);
  if (!serviceLabel.includes("bronze")) return null;

  const caption = "Para sua sessão de bronzeamento, traga 1 toalha e 1 protetor solar facial. Venha com roupa escura e leve e com a pele limpa, sem cremes ou hidratantes.";
  const [existing] = await db
    .select()
    .from(whatsappMessagesTable)
    .where(and(
      eq(whatsappMessagesTable.appointmentId, appointment.id),
      eq(whatsappMessagesTable.kind, "image"),
      inArray(whatsappMessagesTable.status, ["sent", "delivered"]),
    ))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(1);
  if (existing) return toWhatsappMessage(existing);

  const pending = await addWhatsappMessage({
    direction: "outbound",
    phone: normalizeWhatsappPhone(phone),
    clientName,
    appointmentId: appointment.id,
    text: caption,
    status: "pending",
    kind: "image",
    providerMessageId: null,
    error: null,
  });
  const result = await sendEvolutionSessionPreparationImage(phone, caption);
  if (!result.ok) {
    logger.warn(
      { err: result.error, phone, appointmentId: appointment.id },
      "WhatsApp session preparation image send failed",
    );
  }
  return (await updateWhatsappMessage(pending.id, {
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
    error: result.error,
  })) ?? pending;
};

const sendWhatsappAudioMessage = async (
  phone: string,
  clientName: string,
  clip: WhatsappAudioClip,
  appointmentId: number | null = null,
) => {
  const labels: Record<WhatsappAudioClip, string> = {
    combos: "Áudio pré-gravado enviado: explicação dos combos",
    bronze: "Áudio pré-gravado enviado: informações sobre bronzeamento",
  };
  const item = await addWhatsappMessage({
    direction: "outbound",
    phone: normalizeWhatsappPhone(phone),
    clientName,
    appointmentId,
    text: labels[clip],
    status: "pending",
    kind: "audio",
    providerMessageId: null,
    error: null,
  });
  const result = await sendEvolutionAudio(phone, clip);
  if (!result.ok) {
    logger.warn({ err: result.error, phone, clip }, "WhatsApp pre-recorded audio send failed");
  }
  return (await updateWhatsappMessage(item.id, {
    status: result.ok ? "sent" : "failed",
    providerMessageId: result.providerMessageId,
    error: result.error,
  })) ?? item;
};

type AgentAppointmentDraft = {
  clientName: string;
  service: string;
  professional: string;
  start: string;
  end: string;
  confirmed: boolean;
};

type AgentDecision = {
  reply: string;
  handoff: boolean;
  document: WhatsappDocument | null;
  audioClip: WhatsappAudioClip | null;
  appointment: AgentAppointmentDraft | null;
};

type WhatsappAgentImageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

type WhatsappAgentInput = string | WhatsappAgentImageContent[];

const parseAgentDecision = (content: string): AgentDecision => {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const value = JSON.parse(cleaned) as Record<string, unknown>;
    const rawAppointment = value.appointment as Record<string, unknown> | null | undefined;
    const document = value.document === "menu" || value.document === "advanced"
      ? value.document
      : null;
    const audioClip = value.audioClip === "combos" || value.audioClip === "bronze"
      ? value.audioClip
      : null;
    const appointment = rawAppointment &&
      typeof rawAppointment.clientName === "string" &&
      typeof rawAppointment.service === "string" &&
      typeof rawAppointment.start === "string" &&
      typeof rawAppointment.end === "string"
      ? {
          clientName: rawAppointment.clientName.trim(),
          service: rawAppointment.service.trim(),
          professional: typeof rawAppointment.professional === "string" ? rawAppointment.professional.trim() : "",
          start: rawAppointment.start.trim(),
          end: rawAppointment.end.trim(),
          confirmed: rawAppointment.confirmed === true,
        }
      : null;
    const reply = typeof value.reply === "string" ? value.reply.replace(/\*\*/g, "").trim() : "";
    if (!reply) throw new Error("O agente retornou um JSON sem reply");
    return {
      reply,
      handoff: value.handoff === true,
      document,
      audioClip,
      appointment,
    };
  } catch (error) {
    throw new Error(
      `Resposta inválida do agente: ${error instanceof Error ? error.message : "JSON inválido"}`,
    );
  }
};

const getConversationHistory = async (phone: string) => {
  const messages = await db
    .select({ direction: whatsappMessagesTable.direction, text: whatsappMessagesTable.text })
    .from(whatsappMessagesTable)
    .where(eq(whatsappMessagesTable.phone, normalizeWhatsappPhone(phone)))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(12);
  return messages.reverse().map((message) => ({
      role: message.direction === "inbound" ? "user" as const : "assistant" as const,
      content: message.text,
    }));
};

const getFutureAgendaContext = () => {
  const agendaDate = localAgendaDate();
  return appointments
    .filter((appointment) => appointment.status === "confirmed" || appointment.status === "in_progress")
    .map((appointment) => {
      const start = appointmentDateTimeInAgenda(appointment.start, agendaDate);
      const end = appointmentDateTimeInAgenda(appointment.end, agendaDate);
      const startLabel = start && /^\d{2}:\d{2}(?::\d{2})?$/.test(appointment.start)
        ? `${agendaDate}T${appointment.start}`
        : appointment.start;
      const endLabel = end && /^\d{2}:\d{2}(?::\d{2})?$/.test(appointment.end)
        ? `${agendaDate}T${appointment.end}`
        : appointment.end;
      return `${startLabel} | ${endLabel} | ${appointment.service} | ${appointment.professional || "equipe"}`;
    })
    .join("\n") || "Nenhum agendamento futuro informado.";
};

const askWhatsappAgent = async (
  phone: string,
  clientName: string,
  text: string,
  isFirstClientMessage = false,
  currentInput: WhatsappAgentInput = `Cliente: ${clientName}\nMensagem: ${text}`,
): Promise<AgentDecision> => {
  const serviceTable = services
    .map((service) => `- ${service.name} | ${service.category} | ${service.duration} | ${service.price}`)
    .join("\n");
  const currentDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: whatsappAutomation.timezone,
  }).format(new Date());
  const response = await openai.chat.completions.create({
    model: OPENAI_TEXT_MODEL,
    max_completion_tokens: 1600,
    messages: [
      {
        role: "system",
        content: `Você é ${aiAgentConfig.name}, atendente do Spa e Bronze Belém.
Responda em português do Brasil, com tom ${aiAgentConfig.tone}, de forma muito curta, natural e acolhedora.
Objetivo: ${aiAgentConfig.objective}
Saudação: ${aiAgentConfig.greeting}
Instruções: ${aiAgentConfig.instructions}
Horários: ${aiAgentConfig.businessHours}
Endereço: ${aiAgentConfig.address}
Formas de pagamento: ${aiAgentConfig.paymentMethods}
Regras: ${aiAgentConfig.bookingRules}
Políticas: ${aiAgentConfig.policies}
Quando chamar uma pessoa: ${aiAgentConfig.humanHandoff}

BASE DE CONHECIMENTO DOS CATÁLOGOS:
${catalogKnowledge}

SERVIÇOS CADASTRADOS NO SISTEMA:
${serviceTable}

DATA LOCAL DE HOJE: ${currentDate}
FUSO: ${whatsappAutomation.timezone}
AGENDA ATUAL:
${getFutureAgendaContext()}

REGRAS OBRIGATÓRIAS:
- Responda normalmente em no máximo duas frases curtas no total. Na primeira mensagem, cumprimente e já responda dentro desse limite.
- Receba bem a cliente e use humor leve quando combinar, sem fazer piadas forçadas ou falar demais.
- Use exatamente um emoji discreto no final da resposta. Varie naturalmente entre emojis como 🤎, 😊, 🌿, 💛, 🫶 e ✨; não repita ✨ em quase todas as mensagens e não use emojis no meio do texto.
- Varie confirmações e vocativos: não repita “Claro, meu bem” em quase todas as respostas. Alterne expressões como “Sim”, “Com certeza”, “Pode deixar”, “Perfeito” e “Vou te ajudar”, usando “meu bem” apenas quando soar natural.
- Reassuma sempre o assunto principal da conversa usando o histórico; entenda a pergunta atual antes de responder e não fuja do contexto.
- Se a mensagem vier com uma imagem, observe-a antes de responder e use apenas o que estiver visível nela. Se vier de áudio, considere a transcrição como a mensagem da cliente.
- Se a cliente fizer uma pergunta de continuação, responda diretamente a ela sem repetir toda a apresentação. Se faltar informação, faça uma única pergunta curta para esclarecer.
- Mantenha-se simpática, paciente e acolhedora em todas as respostas. Não use respostas genéricas quando houver contexto suficiente.
- ${isFirstClientMessage ? "Esta é a primeira mensagem do cliente. Comece a resposta usando a saudação configurada, sem trocar por uma mensagem genérica de encaminhamento." : "Não repita a saudação configurada em todas as mensagens."}
- Não invente preços, promoções, horários, contraindicações ou resultados.
- Procedimentos estéticos avançados não devem receber diagnóstico ou indicação clínica; explique esse limite com simpatia e faça uma pergunta curta, sem encaminhar para uma atendente.
- Para agendar, conduza a cliente passo a passo: confirme serviço, data, horário exato e nome, perguntando apenas o próximo item que faltar. “Amanhã” sem horário não é confirmação; pergunte qual horário ela prefere. Só crie appointment depois de confirmação explícita e sempre envie uma resposta curta.
- Use datas ISO locais completas (AAAA-MM-DDTHH:mm) no campo appointment somente quando o cliente tiver informado data e horário exatos e confirmado que deseja agendar.
- Consulte a AGENDA ATUAL antes de propor ou confirmar um horário. Nunca crie appointment em um horário ocupado; se houver conflito, explique que o horário não está disponível e peça outra opção.
- Nunca marque appointment quando faltar serviço, data, horário ou confirmação explícita.
- Se o cliente pedir o cardápio geral, use document "menu". Se pedir estética avançada, use document "advanced". Caso contrário, document deve ser null.
- Há dois áudios pré-gravados disponíveis para enviar junto com uma mensagem de texto:
  - audioClip "combos": gravação que explica os combos do Spa e Bronze.
  - audioClip "bronze": gravação sobre bronzeamento.
  Escolha um somente se o pedido atual da cliente for diretamente sobre esse tema e a gravação for pertinente; nos demais casos use null. Se escolher um áudio, a resposta escrita deve ser apenas uma introdução curta ao áudio, sem inventar preços ou detalhes que não estejam confirmados.
- Só marque handoff true se a cliente pedir explicitamente uma atendente, uma pessoa ou atendimento humano. Reclamações, negociação, dúvidas clínicas, falta de informação e reagendamento continuam na conversa.
- Retorne SOMENTE um JSON válido, sem Markdown, neste formato:
{"reply":"texto curto","handoff":false,"document":null,"audioClip":null,"appointment":null}
ou, quando houver agendamento confirmado:
{"reply":"texto curto","handoff":false,"document":null,"audioClip":null,"appointment":{"clientName":"nome","service":"serviço","professional":"","start":"AAAA-MM-DDTHH:mm","end":"AAAA-MM-DDTHH:mm","confirmed":true}}`,
      },
      ...(await getConversationHistory(phone)).slice(0, -1),
      { role: "user", content: currentInput },
    ],
  });
  return parseAgentDecision(response.choices[0]?.message?.content ?? "");
};

const isAppointmentConflict = (draft: AgentAppointmentDraft) => {
  const start = appointmentDateTime(draft.start)?.getTime();
  const end = appointmentDateTime(draft.end)?.getTime();
  if (start == null || end == null || end <= start) return true;
  const agendaDate = localAgendaDate();
  return appointments.some((appointment) => {
    if (appointment.status !== "confirmed" && appointment.status !== "in_progress") return false;
    const existingStart = appointmentDateTimeInAgenda(appointment.start, agendaDate)?.getTime();
    const existingEnd = appointmentDateTimeInAgenda(appointment.end, agendaDate)?.getTime();
    if (existingStart == null || existingEnd == null) return false;
    const sameProfessional = !draft.professional || !appointment.professional ||
      normalizeName(draft.professional) === normalizeName(appointment.professional);
    return sameProfessional && start < existingEnd && end > existingStart;
  });
};

const addAppointmentFromAgent = (phone: string, draft: AgentAppointmentDraft) => {
  if (!draft.confirmed) return null;
  const clientName = draft.clientName || phone;
  let client = clients.find((item) => normalizeWhatsappPhone(item.phone) === normalizeWhatsappPhone(phone));
  const existingClientName = client?.name ?? clientName;
  const draftStart = appointmentDateTime(draft.start)?.getTime();
  const draftEnd = appointmentDateTime(draft.end)?.getTime();
  if (draftStart == null || draftEnd == null || draftEnd <= draftStart) return null;
  const existingForClient = client && appointments.find((appointment) => {
    if (
      appointment.status !== "confirmed" ||
      normalizeName(appointment.client) !== normalizeName(existingClientName) ||
      normalizeName(appointment.service) !== normalizeName(draft.service)
    ) {
      return false;
    }
    const existingStart = appointmentDateTimeInAgenda(appointment.start)?.getTime();
    const existingEnd = appointmentDateTimeInAgenda(appointment.end)?.getTime();
    const sameProfessional = !draft.professional || !appointment.professional ||
      normalizeName(draft.professional) === normalizeName(appointment.professional);
    return sameProfessional && existingStart === draftStart && existingEnd === draftEnd;
  });
  if (existingForClient) return existingForClient;
  if (isAppointmentConflict(draft)) return null;
  if (!client) {
    client = {
      id: clients.length ? Math.max(...clients.map((item) => item.id)) + 1 : 1,
      name: clientName,
      initials: getInitials(clientName),
      lastVisit: "",
      service: draft.service,
      status: "new",
      source: "WhatsApp",
      phone: normalizeWhatsappPhone(phone),
      email: "",
      notes: "Cliente cadastrado a partir de conversa no WhatsApp.",
    };
    clients.unshift(client);
  }
  const appointment: Appointment = {
    id: appointments.length ? Math.max(...appointments.map((item) => item.id)) + 1 : 1,
    start: draft.start,
    end: draft.end,
    client: client.name,
    service: draft.service,
    professional: draft.professional,
    room: "",
    status: "confirmed",
    avatar: getInitials(client.name),
  };
  appointments.push(appointment);
  return appointment;
};

export const runWhatsappReminders = async () => {
  await loadWhatsappSettings();
  if (!whatsappAutomation.enabled) return;
  const now = Date.now();
  for (const appointment of appointments) {
    if (appointment.status !== "confirmed") continue;
    const date = appointmentDateTime(appointment.start);
    if (!date) continue;
    const hours = (date.getTime() - now) / 3_600_000;
    if (whatsappAutomation.reminder24h && hours > 23 && hours <= 25) {
      await sendAppointmentMessage(appointment, "reminder24h");
    }
    if (whatsappAutomation.reminder2h && hours > 1 && hours <= 3) {
      await sendAppointmentMessage(appointment, "reminder2h");
    }
  }
};

const leads: Lead[] = [
  {
    id: 1,
    name: "Camila Rocha",
    initials: "CR",
    phone: "(91) 98814-2031",
    source: "Tráfego pago",
    service: "Bronzeamento a sol",
    stage: "new",
    lastMessage: "Queria saber os horários para sábado",
    time: "há 4 min",
    value: "R$ 140",
  },
  {
    id: 2,
    name: "Fernanda Melo",
    initials: "FM",
    phone: "(91) 98152-7720",
    source: "Instagram",
    service: "Estética facial",
    stage: "contacting",
    lastMessage: "Pode me explicar como funciona o protocolo?",
    time: "há 18 min",
    value: "R$ 280",
  },
  {
    id: 3,
    name: "Patrícia Gomes",
    initials: "PG",
    phone: "(91) 99220-4855",
    source: "Indicação",
    service: "Banho de lua",
    stage: "quote",
    lastMessage: "Recebi o orçamento, vou confirmar ainda hoje",
    time: "há 42 min",
    value: "R$ 190",
  },
  {
    id: 4,
    name: "Larissa Dias",
    initials: "LD",
    phone: "(91) 98750-1194",
    source: "Tráfego pago",
    service: "Massagem relaxante",
    stage: "scheduled",
    lastMessage: "Perfeito, estarei aí às 16h",
    time: "há 1 h",
    value: "R$ 180",
  },
  {
    id: 5,
    name: "Débora Nunes",
    initials: "DN",
    phone: "(91) 98009-6741",
    source: "Instagram",
    service: "Drenagem linfática",
    stage: "converted",
    lastMessage: "Pagamento realizado, obrigada!",
    time: "ontem",
    value: "R$ 480",
  },
];

type Quote = {
  id: number;
  number: string;
  createdAt: string;
  status: "draft" | "sent" | "viewed" | "approved" | "rejected" | "expired" | "cancelled";
  clientId: number;
  clientName: string;
  phone: string;
  validUntil: string;
  discountMode: "fixed" | "percent";
  discountValue: number;
  customerNotes: string;
  internalNotes: string;
  paymentMethods: Array<"pix" | "credit" | "debit" | "cash" | "boleto">;
  installments: number;
  discount: number;
  items: Array<{
    type: "service" | "package" | "product" | "gift_card";
    refId?: number;
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    professionalId?: number;
    professionalName?: string;
    commissionPercent?: number;
    estimatedCommission?: number;
    scheduledDate?: string;
    scheduledTime?: string;
    sessions?: number;
  }>;
  subtotal: number;
  total: number;
  publicToken: string;
  sentAt?: string;
  viewedAt?: string;
  approvedAt?: string;
  paidAt?: string;
};

const quotes: Quote[] = [];

const services = [
  {
    id: 1,
    name: "Massagem Relaxante",
    category: "Massagens",
    duration: "60 min",
    price: "R$ 180",
    accent: "sage",
  },
  {
    id: 2,
    name: "Drenagem Linfática",
    category: "Corporal",
    duration: "50 min",
    price: "R$ 160",
    accent: "champagne",
  },
  {
    id: 3,
    name: "Ritual Facial",
    category: "Estética facial",
    duration: "75 min",
    price: "R$ 240",
    accent: "clay",
  },
  {
    id: 4,
    name: "Bronzeamento em máquina",
    category: "Bronze",
    duration: "40 min",
    price: "R$ 120",
    accent: "bronze",
  },
  {
    id: 5,
    name: "Banho de Lua",
    category: "Bronze",
    duration: "90 min",
    price: "R$ 190",
    accent: "sand",
  },
  {
    id: 6,
    name: "Estética Corporal Avançada",
    category: "Corporal",
    duration: "80 min",
    price: "R$ 320",
    accent: "olive",
  },
];
const packages = [{ id: 1, name: "Pacote Relax", price: 720, sessions: 4, serviceId: 1 }];

let aiAgentConfig: ReturnType<typeof GetAiAgentConfigResponse.parse> = {
  active: false,
  name: "Luna",
  tone: "acolhedor",
  greeting: "Olá! Sou a assistente virtual do Spa e Bronze Belém. Como posso ajudar?",
  objective: "Atender clientes, apresentar serviços e preços e orientar sobre agendamentos.",
  instructions: "Responda de forma clara, curta e cordial. Faça uma pergunta por vez.",
  businessHours: "Segunda a sábado, das 8h às 19h.",
  address: "Belém - PA",
  paymentMethods: "Pix, cartão de crédito, cartão de débito e dinheiro.",
  bookingRules: "Confirme serviço, data, horário e nome da cliente antes de encaminhar o agendamento.",
  policies: "Não prometa horários sem confirmação. Não ofereça diagnóstico médico.",
  humanHandoff: "Só encaminhe para uma atendente se a cliente pedir explicitamente uma pessoa ou atendimento humano.",
};

const readKnowledgeFile = (relativePath: string) => {
  const candidates = [
    resolve(process.cwd(), relativePath),
    resolve(process.cwd(), "../../", relativePath),
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, "utf8").trim();
    } catch {
      // Try the next workspace-relative location.
    }
  }
  return "";
};

const catalogKnowledge = [
  readKnowledgeFile("artifacts/api-server/src/data/catalog-knowledge.txt"),
  readKnowledgeFile(
    "attached_assets/Pasted-BRIEFING-GERAL-CHATBOT-IA-SPA-BRONZE-BEL-M-1-SOBRE-A-EM_1790169702654.txt",
  ),
].filter(Boolean).join("\n\n===== BRIEFING OPERACIONAL COMPLETO =====\n\n")
  || "Os catálogos em PDF estão disponíveis para envio. Quando faltar informação, explique o limite e faça uma pergunta curta.";

const inventory = backup.inventory.map((item) => ({ ...item }));

const getInitials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const parseMoney = (value: string | number | undefined): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const appointmentDate = (start: string): string | null => {
  if (/^\d{4}-\d{2}-\d{2}(?:$|T|\s)/.test(start)) {
    const date = start.slice(0, 10);
    const parsed = new Date(`${date}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date;
  }
  return null;
};
const professionalForAppointment = (appointment: Appointment) => {
  const record = appointment as Appointment & { professionalId?: number };
  return record.professionalId
    ? professionals.find((professional) => professional.id === record.professionalId)
    : professionals.find((professional) => professional.name.toLocaleLowerCase("pt-BR") === appointment.professional.toLocaleLowerCase("pt-BR"));
};
const serviceForAppointment = (appointment: Appointment) => {
  const record = appointment as Appointment & { serviceId?: number };
  return record.serviceId
    ? services.find((service) => service.id === record.serviceId)
    : services.find((service) => service.name.toLocaleLowerCase("pt-BR") === appointment.service.toLocaleLowerCase("pt-BR"));
};

const getCommissionItems = (from: string, to: string, professionalId?: number): CommissionItem[] => {
  const closedItems = new Map<number, "closed" | "paid">();
  for (const closure of commissionClosures) {
    if (closure.status !== "open") {
      for (const itemId of closure.itemIds) closedItems.set(itemId, closure.status);
    }
  }
  return appointments
    .filter((appointment) => appointment.status === "completed")
    .filter((appointment) => {
      const date = appointmentDate(appointment.start);
      return !date || (date >= from && date <= to);
    })
    .filter((appointment) => !professionalId || professionalForAppointment(appointment)?.id === professionalId)
    .map((appointment): CommissionItem => {
      const professional = professionalForAppointment(appointment);
      const service = serviceForAppointment(appointment);
      const config = professional ? commissionConfigs.get(professional.id) : undefined;
      const date = appointmentDate(appointment.start);
      const rule = professional && service
        ? commissionRules.find((entry) => entry.professionalId === professional.id && entry.serviceId === service.id && entry.active)
        : undefined;
      const rateType = rule?.type ?? config?.commissionType ?? "percent";
      const rateValue = rule?.value ?? config?.defaultValue ?? null;
      const baseAmount = service ? parseMoney(service.price) : null;
      let status: CommissionItem["status"] = "eligible";
      let blockedReason: string | null = null;
      if (!date) {
        status = "blocked";
        blockedReason = "Agendamento sem data real";
      } else if (!professional) {
        status = "blocked";
        blockedReason = "Profissional não resolvido";
      } else if (!service || baseAmount == null) {
        status = "blocked";
        blockedReason = "Serviço ou preço não resolvido";
      } else if (!config) {
        status = "blocked";
        blockedReason = "Configuração de comissão ausente";
      } else if (config.calculationBase !== "gross") {
        status = "blocked";
        blockedReason = `Base ${config.calculationBase} indisponível nos dados atuais`;
      } else if (config.discountInCalculation) {
        status = "blocked";
        blockedReason = "Descontos do atendimento não disponíveis";
      } else if (config.cardFeeInCalculation) {
        status = "blocked";
        blockedReason = "Taxa de cartão não disponível";
      }
      const commissionAmount = status === "eligible" && rateValue != null
        ? rateType === "percent" ? baseAmount! * rateValue / 100 : rateValue
        : null;
      const itemId = appointment.id;
      const closedStatus = closedItems.get(itemId);
      if (closedStatus && status === "eligible") status = closedStatus;
      return {
        id: itemId,
        appointmentId: appointment.id,
        professionalId: professional?.id ?? null,
        professionalName: professional?.name ?? appointment.professional,
        serviceId: service?.id ?? null,
        serviceName: service?.name ?? appointment.service,
        date,
        status,
        blockedReason,
        baseAmount,
        rateType,
        rateValue,
        commissionAmount,
        calculationBase: config?.calculationBase ?? "gross",
        snapshot: {
          baseAmount,
          rateType,
          rateValue,
          calculationBase: config?.calculationBase ?? "gross",
          ruleId: rule?.id ?? null,
          discountInCalculation: config?.discountInCalculation ?? false,
          cardFeeInCalculation: config?.cardFeeInCalculation ?? false,
        },
      };
    });
};

const audit = (
  action: CommissionAudit["action"],
  professionalId: number,
  closureId: number | null,
  username: string,
  before: unknown,
  after: unknown,
) => {
  commissionAudit.unshift({
    id: commissionAudit.length ? Math.max(...commissionAudit.map((entry) => entry.id)) + 1 : 1,
    action,
    professionalId,
    closureId,
    username,
    timestamp: new Date().toISOString(),
    before: before == null ? null : clone(before) as Record<string, unknown>,
    after: after == null ? null : clone(after) as Record<string, unknown>,
  });
};

const getInventoryStatus = (stock: number, minimumStock: number, nextExpiration: string) => {
  const [day, month, year] = nextExpiration.split("/").map(Number);
  const expiration = year && month && day ? new Date(year, month - 1, day) : null;
  if (expiration && expiration < new Date()) return "expired" as const;
  if (stock < 0) return "negative" as const;
  if (stock <= minimumStock) return "low" as const;
  return "ok" as const;
};

router.get("/dashboard", (_req, res) => {
  const data = GetDashboardResponse.parse({
    greeting: "Bom dia, Wagner",
    subtitle: "Acompanhe a operação do seu spa em um só lugar.",
    dateLabel: "Quarta-feira, 09 de setembro",
    metrics: [
      {
        label: "Faturamento total",
        value: backup.meta.totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        change: "Valor registrado",
        trend: "neutral",
      },
      {
        label: "Comandas",
        value: backup.meta.totalOrders.toLocaleString("pt-BR"),
        change: "Atendimentos realizados",
        trend: "neutral",
      },
      {
        label: "Clientes",
        value: backup.meta.clients.toLocaleString("pt-BR"),
        change: "Cadastros disponíveis",
        trend: "neutral",
      },
      {
        label: "Produtos",
        value: backup.meta.inventoryItems.toLocaleString("pt-BR"),
        change: "Itens cadastrados",
        trend: "neutral",
      },
    ],
    revenue: [{ label: "Total", value: backup.meta.totalRevenue }],
    serviceMix: [],
    currentAppointment: appointments.find(
      (appointment) => appointment.status === "in_progress",
    ),
  });
  res.json(data);
});

router.get("/appointments", (req, res) => {
  const { date } = ListAppointmentsQueryParams.parse(req.query);
  const today = new Date().toLocaleDateString("sv-SE");
  const filtered = date
    ? appointments.filter((appointment) => {
        if (/^\d{2}:\d{2}/.test(appointment.start)) return date === today;
        return appointment.start.slice(0, 10) === date;
      })
    : appointments;
  res.json(ListAppointmentsResponse.parse(filtered));
});

router.post("/appointments", (req, res) => {
  const input = CreateAppointmentBody.parse(req.body);
  const appointment: Appointment = {
    id: Math.max(...appointments.map((item) => item.id)) + 1,
    ...input,
    status: "confirmed",
    avatar: input.client
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
  };
  appointments.push(appointment);
  if (whatsappAutomation.enabled && whatsappAutomation.confirmations) {
    void sendAppointmentMessage(appointment, "confirmation");
  }
  res.status(201).json(CreateAppointmentResponse.parse(appointment));
});

router.patch("/appointments/:id", (req, res) => {
  const { id } = UpdateAppointmentParams.parse(req.params);
  const input = UpdateAppointmentBody.parse(req.body);
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) return void res.status(404).json({ error: "Agendamento não encontrado" });
  Object.assign(appointment, input, input.client ? { avatar: getInitials(input.client) } : {});
  if (
    whatsappAutomation.enabled &&
    whatsappAutomation.confirmations &&
    appointment.status === "confirmed" &&
    (input.start || input.client || input.service || input.professional)
  ) {
    void sendAppointmentMessage(appointment, "confirmation");
  }
  res.json(UpdateAppointmentResponse.parse(appointment));
});

router.delete("/appointments/:id", (req, res) => {
  const { id } = DeleteAppointmentParams.parse(req.params);
  const index = appointments.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Agendamento não encontrado" });
  appointments.splice(index, 1);
  res.status(204).end();
});

router.get("/whatsapp/connection", async (_req, res) => {
  const connection = await getEvolutionConnection();
  if (connection.connected && connection.instance) {
    await configureEvolutionWebhook(connection.instance);
  }
  res.json(GetWhatsappConnectionResponse.parse(connection));
});

router.post("/whatsapp/connect", async (_req, res) => {
  res.json(ConnectWhatsappResponse.parse(await connectEvolutionInstance()));
});

router.post("/whatsapp/disconnect", async (_req, res) => {
  res.json(DisconnectWhatsappResponse.parse(await disconnectEvolutionInstance()));
});

router.get("/whatsapp/automation", (_req, res) => {
  void (async () => {
    await loadWhatsappSettings();
    res.json(GetWhatsappAutomationResponse.parse(whatsappAutomation));
  })();
});

router.put("/whatsapp/automation", (req, res) => {
  void (async () => {
    await loadWhatsappSettings();
    whatsappAutomation = UpdateWhatsappAutomationBody.parse(req.body);
    await saveWhatsappSettings();
    res.json(UpdateWhatsappAutomationResponse.parse(whatsappAutomation));
  })();
});

router.get("/whatsapp/messages", (req, res) => {
  void (async () => {
    const { limit = 50 } = ListWhatsappMessagesQueryParams.parse(req.query);
    const messages = await db
      .select()
      .from(whatsappMessagesTable)
      .orderBy(desc(whatsappMessagesTable.createdAt))
      .limit(limit);
    res.json(ListWhatsappMessagesResponse.parse(messages.map(toWhatsappMessage)));
  })();
});

router.get("/whatsapp/conversations", async (req, res) => {
  const { limit = 50 } = ListWhatsappConversationsQueryParams.parse(req.query);
  const conversations = await db
    .select()
    .from(whatsappConversationsTable)
    .orderBy(desc(whatsappConversationsTable.lastMessageAt))
    .limit(limit);
  res.json(ListWhatsappConversationsResponse.parse(await Promise.all(conversations.map(toWhatsappConversation))));
});

router.patch("/whatsapp/conversations/:phone", async (req, res) => {
  const { phone } = UpdateWhatsappConversationParams.parse(req.params);
  const { status } = UpdateWhatsappConversationBody.parse(req.body);
  const conversation = await setWhatsappConversationStatus(phone, status);
  const summary = await toWhatsappConversation(conversation);
  res.json(UpdateWhatsappConversationResponse.parse(summary));
});

router.delete("/whatsapp/conversations/:phone", async (req, res) => {
  const { phone } = DeleteWhatsappConversationParams.parse(req.params);
  const conversation = await getWhatsappConversation(phone);
  if (!conversation) return void res.status(404).json({ error: "Conversa não encontrada" });
  await db.delete(whatsappConversationsTable).where(eq(whatsappConversationsTable.id, conversation.id));
  res.status(204).end();
});

router.post("/whatsapp/reply", async (req, res) => {
  const input = SendWhatsappReplyBody.parse(req.body);
  await setWhatsappConversationStatus(input.phone, "human");
  const message = await sendWhatsappReply(input.phone, input.clientName, null, input.text);
  res.json(SendWhatsappReplyResponse.parse(message));
});

router.post("/whatsapp/documents", async (req, res) => {
  const input = SendWhatsappDocumentBody.parse(req.body);
  const message = await sendWhatsappDocumentMessage(
    input.phone,
    input.clientName,
    input.document,
    input.caption,
  );
  res.json(SendWhatsappDocumentResponse.parse(message));
});

router.post("/whatsapp/appointments/:id/confirmation", async (req, res) => {
  const id = Number(req.params.id);
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) return void res.status(404).json({ error: "Agendamento não encontrado" });
  const message = await sendAppointmentMessage(appointment, "confirmation");
  res.json(SendWhatsappAppointmentConfirmationResponse.parse({
    sent: message.status === "sent" || message.status === "delivered",
    message,
  }));
});

router.post("/integrations/evolution/webhook", async (req, res) => {
  await loadWhatsappSettings();
  const body = ReceiveEvolutionWebhookBody.parse(req.body);
  const data = (body["data"] as Record<string, unknown> | undefined) ?? body;
  const key = (data["key"] as Record<string, unknown> | undefined) ?? {};
  if (key["fromMe"] === true) {
    return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "ignored_from_me" }));
  }
  const remoteJid = String(key["remoteJid"] ?? "");
  const phone = remoteJid.split("@")[0];
  const providerMessageId = typeof key["id"] === "string" ? key["id"] : null;
  const normalizedPhone = normalizeWhatsappPhone(phone);
  const processingKey = providerMessageId && normalizedPhone
    ? `${normalizedPhone}:${providerMessageId}`
    : null;
  if (providerMessageId && normalizedPhone) {
    const [existingInboundMessage] = await db
      .select({ id: whatsappMessagesTable.id })
      .from(whatsappMessagesTable)
      .where(and(
        eq(whatsappMessagesTable.providerMessageId, providerMessageId),
        eq(whatsappMessagesTable.direction, "inbound"),
      ))
      .limit(1);
    if (existingInboundMessage || (processingKey && processingWhatsappWebhookMessageIds.has(processingKey))) {
      return void res.json(ReceiveEvolutionWebhookResponse.parse({
        received: true,
        action: "duplicate_ignored",
      }));
    }
    if (processingKey) {
      processingWhatsappWebhookMessageIds.add(processingKey);
      const releaseProcessingKey = () => processingWhatsappWebhookMessageIds.delete(processingKey);
      res.once("finish", releaseProcessingKey);
      res.once("close", releaseProcessingKey);
    }
  }
  const rawMessage = (data["message"] as Record<string, unknown> | undefined) ?? {};
  const contentMessage = unwrapWhatsappMessage(rawMessage);
  const extended = contentMessage["extendedTextMessage"] as Record<string, unknown> | undefined;
  const audioMessage = contentMessage["audioMessage"] as Record<string, unknown> | undefined;
  const imageMessage = contentMessage["imageMessage"] as Record<string, unknown> | undefined;
  const isAudioMessage = Boolean(audioMessage);
  const isImageMessage = Boolean(imageMessage);
  const imageCaption = typeof imageMessage?.caption === "string" ? imageMessage.caption.trim() : "";
  let text = String(contentMessage["conversation"] ?? extended?.["text"] ?? imageCaption).trim();
  let currentInput: WhatsappAgentInput = "";
  let mediaError: string | null = null;

  if (isAudioMessage) {
    try {
      const media = await getEvolutionMedia(key, rawMessage, "audio");
      const compatible = await ensureCompatibleFormat(media.buffer);
      logger.info(
        {
          phone,
          mimetype: media.mimetype,
          bytes: media.buffer.length,
          format: compatible.format,
        },
        "WhatsApp audio received for transcription",
      );
      const transcript = await speechToText(compatible.buffer, compatible.format);
      text = transcript.trim();
      logger.info(
        { phone, transcriptLength: text.length },
        "WhatsApp audio transcription completed",
      );
      if (!text) mediaError = "Não consegui identificar o conteúdo do áudio.";
    } catch (error) {
      mediaError = error instanceof Error ? error.message : "Não foi possível entender o áudio.";
      logger.warn(
        { err: error, phone },
        "WhatsApp audio transcription failed",
      );
      text = "Áudio recebido";
    }
  } else if (isImageMessage) {
    text = imageCaption ? `[Imagem recebida com legenda: ${imageCaption}]` : "[Imagem recebida]";
    try {
      const media = await getEvolutionMedia(key, rawMessage, "image");
      currentInput = [
        {
          type: "text",
          text: `Cliente: ${phone}\nMensagem: ${text}\nAnalise a imagem recebida e responda de forma útil, sem inventar informações.`,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:${media.mimetype};base64,${media.buffer.toString("base64")}`,
          },
        },
      ];
    } catch (error) {
      mediaError = error instanceof Error ? error.message : "Não foi possível analisar a imagem.";
    }
  }

  if (!phone || (!text && !isAudioMessage && !isImageMessage)) {
    return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "ignored_without_text" }));
  }
  if (!currentInput) currentInput = `Cliente: ${phone}\nMensagem: ${text}`;
  const replyReference = providerMessageId
    ? {
        remoteJid: remoteJid || `${normalizeWhatsappPhone(phone)}@s.whatsapp.net`,
        fromMe: false,
        id: providerMessageId,
        message: rawMessage,
      } satisfies EvolutionReplyReference
    : undefined;

  const client = clients.find((item) => normalizeWhatsappPhone(item.phone) === normalizeWhatsappPhone(phone));
  const appointment = appointments
    .filter((item) => item.status === "confirmed" && client && normalizeName(item.client) === normalizeName(client.name))
    .filter((item) => (appointmentDateTime(item.start)?.getTime() ?? Number.MAX_SAFE_INTEGER) > Date.now())
    .sort((a, b) => (appointmentDateTime(a.start)?.getTime() ?? 0) - (appointmentDateTime(b.start)?.getTime() ?? 0))[0];
  const normalizedText = text.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const [previousInboundMessage] = await db
    .select({ id: whatsappMessagesTable.id })
    .from(whatsappMessagesTable)
    .where(and(
      eq(whatsappMessagesTable.phone, normalizeWhatsappPhone(phone)),
      eq(whatsappMessagesTable.direction, "inbound"),
    ))
    .limit(1);
  const isFirstClientMessage = !previousInboundMessage;
  await addWhatsappMessage({
    direction: "inbound",
    phone: normalizeWhatsappPhone(phone),
    clientName: client?.name ?? phone,
    appointmentId: appointment?.id ?? null,
    text,
    status: "received",
    kind: "reply",
    providerMessageId,
    error: null,
  });
  if (providerMessageId) {
    const reactionResult = await sendEvolutionReaction(
      phone,
      providerMessageId,
      reactionForWhatsappMessage(providerMessageId, text),
    );
    if (!reactionResult.ok) {
      logger.warn(
        { err: reactionResult.error, phone, providerMessageId },
        "WhatsApp reaction failed",
      );
    }
  }

  const asksForHuman = /(atendente|atendimento humano|pessoa|humano|falar com algu)/i.test(normalizedText);
  const conversation = await getWhatsappConversation(phone);
  if (asksForHuman) {
    await setWhatsappConversationStatus(phone, "human");
    await sendWhatsappReply(
      phone,
      client?.name ?? phone,
      appointment?.id ?? null,
      "Combinado. Vou encaminhar você para uma atendente continuar o atendimento.",
      "handoff",
      replyReference,
    );
    return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "handoff" }));
  }
  if (conversation?.status !== "agent") {
    await setWhatsappConversationStatus(phone, "agent");
  }
  if (isFirstClientMessage) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, FIRST_WHATSAPP_MESSAGE_DELAY_MS));
  }

  if (mediaError) {
    await sendWhatsappReply(
      phone,
      client?.name ?? phone,
      appointment?.id ?? null,
      isAudioMessage
        ? "Não consegui ouvir esse áudio. Pode enviar novamente ou escrever a mensagem, por favor? 🤎"
        : "Não consegui abrir essa imagem agora. Pode enviar novamente, por favor? 🤎",
      "reply",
      replyReference,
    );
    return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "replied" }));
  }

  if (appointment && normalizedText.includes("confirm")) {
    await sendWhatsappReply(phone, appointment.client, appointment.id, "Perfeito! Seu atendimento está confirmado. Até lá!", "reply", replyReference);
    return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "confirmed" }));
  }
  if (appointment && normalizedText.includes("cancel")) {
    appointment.status = "cancelled";
    await sendWhatsappReply(phone, appointment.client, appointment.id, "Tudo bem, seu atendimento foi cancelado. Quando quiser, posso ajudar a encontrar um novo horário.", "reply", replyReference);
    return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "cancelled" }));
  }
  if (!aiAgentConfig.active) {
    return void res.json(ReceiveEvolutionWebhookResponse.parse({
      received: true,
      action: "automation_disabled",
    }));
  }

  try {
    const decision = await askWhatsappAgent(
      phone,
      client?.name ?? phone,
      text,
      isFirstClientMessage,
      currentInput,
    );
    let createdAppointment: Appointment | null = null;
    if (decision.appointment?.confirmed) {
      createdAppointment = addAppointmentFromAgent(phone, decision.appointment);
      if (!createdAppointment) {
        await sendWhatsappReply(
          phone,
          client?.name ?? phone,
          appointment?.id ?? null,
          "Esse horário não ficou disponível. Quer tentar outro horário? 🙂",
          "reply",
          replyReference,
        );
        return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "replied" }));
      }
    }
    if (decision.document) {
      await sendWhatsappDocumentMessage(
        phone,
        client?.name ?? decision.appointment?.clientName ?? phone,
        decision.document,
        decision.document === "menu"
          ? "Segue o nosso cardápio de serviços e bronzeamento."
          : "Segue o nosso catálogo de serviços de estética avançada.",
        createdAppointment?.id ?? appointment?.id ?? null,
        replyReference,
      );
    }
    const audioClip = createdAppointment || decision.document
      ? null
      : decision.audioClip ?? audioClipForWhatsappMessage(normalizedText);
    let writtenReply = decision.reply;
    const replyClientName = client?.name ?? decision.appointment?.clientName ?? phone;
    const replyAppointmentId = createdAppointment?.id ?? appointment?.id ?? null;
    const shouldReplyBeforeAudio = Boolean(
      audioClip && /\b(bronze(?:amento|adas?)?|marquinhas?)\b/.test(normalizedText),
    );
    if (shouldReplyBeforeAudio) {
      await sendWhatsappReply(
        phone,
        replyClientName,
        replyAppointmentId,
        writtenReply,
        "reply",
        replyReference,
      );
    }
    if (audioClip) {
      const audioMessage = await sendWhatsappAudioMessage(
        phone,
        replyClientName,
        audioClip,
        appointment?.id ?? null,
      );
      if (audioMessage.status === "sent" && !shouldReplyBeforeAudio) {
        writtenReply = audioClip === "combos"
          ? "Te enviei um áudio com a explicação dos nossos combos. 🤎"
          : "Te enviei um áudio com informações sobre bronzeamento. 🤎";
      }
    }
    if (!shouldReplyBeforeAudio) {
      await sendWhatsappReply(
        phone,
        replyClientName,
        replyAppointmentId,
        writtenReply,
        "reply",
        replyReference,
      );
    }
    if (createdAppointment) {
      await sendWhatsappSessionPreparationImage(
        createdAppointment,
        phone,
        client?.name ?? decision.appointment?.clientName ?? phone,
      );
    }
    return void res.json(ReceiveEvolutionWebhookResponse.parse({
      received: true,
      action: createdAppointment ? "scheduled" : "replied",
    }));
  } catch (error) {
    logger.error({ err: error, phone }, "WhatsApp AI response failed");
    return void res.json(ReceiveEvolutionWebhookResponse.parse({
      received: true,
      action: "agent_error",
    }));
  }
});

router.get("/clients", (req, res) => {
  const { search } = ListClientsQueryParams.parse(req.query);
  const normalized = search?.trim().toLocaleLowerCase("pt-BR");
  const filtered = normalized
    ? clients.filter((client) =>
        `${client.name} ${client.service} ${client.source}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      )
    : clients;
  res.json(ListClientsResponse.parse(filtered));
});

router.post("/clients", (req, res) => {
  const input = CreateClientBody.parse(req.body);
  const normalizedPhone = input.phone.replace(/\D/g, "");
  if (normalizedPhone && clients.some((client) => client.phone.replace(/\D/g, "") === normalizedPhone)) {
    return void res.status(409).json({ error: "Já existe um cliente com este telefone" });
  }
  const id = clients.length ? Math.max(...clients.map((item) => item.id)) + 1 : 1;
  const client = { id, initials: getInitials(input.name), lastVisit: "", ...input };
  clients.unshift(client);
  res.status(201).json(CreateClientResponse.parse(client));
});

router.patch("/clients/:id", (req, res) => {
  const { id } = UpdateClientParams.parse(req.params);
  const input = UpdateClientBody.parse(req.body);
  const client = clients.find((item) => item.id === id);
  if (!client) return void res.status(404).json({ error: "Cliente não encontrado" });
  Object.assign(client, input, { initials: getInitials(input.name) });
  res.json(UpdateClientResponse.parse(client));
});

router.delete("/clients/:id", (req, res) => {
  const { id } = DeleteClientParams.parse(req.params);
  const index = clients.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Cliente não encontrado" });
  clients.splice(index, 1);
  res.status(204).end();
});

router.get("/leads", (_req, res) => {
  res.json(ListLeadsResponse.parse(leads));
});

router.post("/leads", (req, res) => {
  const input = CreateLeadBody.parse(req.body);
  const lead: Lead = {
    id: Math.max(...leads.map((item) => item.id)) + 1,
    ...input,
    initials: input.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
    stage: "new",
    lastMessage: "Novo contato adicionado pela recepção",
    time: "agora",
    value: "A definir",
  };
  leads.unshift(lead);
  res.status(201).json(CreateLeadResponse.parse(lead));
});

router.patch("/leads/:id", (req, res) => {
  const { id } = UpdateLeadParams.parse(req.params);
  const { stage } = UpdateLeadBody.parse(req.body);
  const lead = leads.find((item) => item.id === id);
  if (!lead) {
    res.status(404).json({ error: "Lead não encontrado" });
    return;
  }
  lead.stage = stage;
  lead.time = "agora";
  res.json(UpdateLeadResponse.parse(lead));
});

router.get("/services", (_req, res) => {
  res.json(ListServicesResponse.parse(services));
});

router.get("/packages", (_req, res) => {
  res.json(packages);
});

router.get("/professionals", (_req, res) => {
  res.json(ListProfessionalsResponse.parse(professionals));
});

router.get("/finance/movements", (req, res) => {
  const { month } = ListFinancialMovementsQueryParams.parse(req.query);
  const filtered = month
    ? financialMovements.filter((movement) => movement.date.startsWith(month))
    : financialMovements;
  res.json(ListFinancialMovementsResponse.parse(filtered));
});

router.post("/finance/movements", (req, res) => {
  const input = CreateFinancialMovementBody.parse(req.body);
  const id = financialMovements.length ? Math.max(...financialMovements.map((movement) => movement.id)) + 1 : 1;
  const movement: FinancialMovement = { id, ...input };
  financialMovements.unshift(movement);
  res.status(201).json(CreateFinancialMovementResponse.parse(movement));
});

router.patch("/finance/movements/:id", (req, res) => {
  const { id } = UpdateFinancialMovementParams.parse(req.params);
  const input = UpdateFinancialMovementBody.parse(req.body);
  const movement = financialMovements.find((item) => item.id === id);
  if (!movement) return void res.status(404).json({ error: "Movimentação não encontrada" });
  Object.assign(movement, input);
  res.json(UpdateFinancialMovementResponse.parse(movement));
});

router.delete("/finance/movements/:id", (req, res) => {
  const { id } = DeleteFinancialMovementParams.parse(req.params);
  const index = financialMovements.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Movimentação não encontrada" });
  financialMovements.splice(index, 1);
  res.status(204).end();
});

router.post("/professionals", (req, res) => {
  const input = CreateProfessionalBody.parse(req.body);
  const id = professionals.length ? Math.max(...professionals.map((professional) => professional.id)) + 1 : 1;
  const professional: Professional = { id, ...input };
  professionals.push(professional);
  commissionConfigs.set(id, {
    professionalId: id,
    commissionType: "percent",
    defaultValue: input.commissionRate,
    calculationBase: "gross",
    discountInCalculation: false,
    cardFeeInCalculation: false,
    cancellationsGenerate: false,
    productsGenerate: false,
    productCommissionPercent: 0,
    updatedAt: new Date().toISOString(),
  });
  res.status(201).json(CreateProfessionalResponse.parse(professional));
});

router.patch("/professionals/:id", (req, res) => {
  const { id } = UpdateProfessionalParams.parse(req.params);
  const input = UpdateProfessionalBody.parse(req.body);
  const professional = professionals.find((item) => item.id === id);
  if (!professional) return void res.status(404).json({ error: "Profissional não encontrado" });
  Object.assign(professional, input);
  if (input.commissionRate !== undefined) {
    const config = commissionConfigs.get(id);
    if (config) {
      config.defaultValue = input.commissionRate;
      config.updatedAt = new Date().toISOString();
    }
  }
  res.json(UpdateProfessionalResponse.parse(professional));
});

router.delete("/professionals/:id", (req, res) => {
  const { id } = DeleteProfessionalParams.parse(req.params);
  const index = professionals.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Profissional não encontrado" });
  if (appointments.some((appointment) => professionalForAppointment(appointment)?.id === id) ||
      commissionClosures.some((closure) => closure.professionalId === id)) {
    return void res.status(409).json({ error: "Profissional possui agendamentos ou fechamentos; desative-o em vez de excluir" });
  }
  professionals.splice(index, 1);
  commissionConfigs.delete(id);
  res.status(204).end();
});

router.get("/ai-agent/config", (_req, res) => {
  void (async () => {
    await loadWhatsappSettings();
    res.json(GetAiAgentConfigResponse.parse(aiAgentConfig));
  })();
});

router.put("/ai-agent/config", (req, res) => {
  void (async () => {
    await loadWhatsappSettings();
    aiAgentConfig = UpdateAiAgentConfigBody.parse(req.body);
    await saveWhatsappSettings();
    res.json(UpdateAiAgentConfigResponse.parse(aiAgentConfig));
  })();
});

router.post("/ai-agent/test", async (req, res, next) => {
  try {
    await loadWhatsappSettings();
    const { message } = TestAiAgentBody.parse(req.body);
    const serviceTable = services
      .map((service) => `- ${service.name} | ${service.category} | ${service.duration} | ${service.price}`)
      .join("\n");
    const response = await openai.chat.completions.create({
      model: OPENAI_TEXT_MODEL,
      max_completion_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `Você é ${aiAgentConfig.name}, agente de atendimento do Spa e Bronze Belém.
Tom: ${aiAgentConfig.tone}.
Objetivo: ${aiAgentConfig.objective}
Saudação: ${aiAgentConfig.greeting}
Instruções: ${aiAgentConfig.instructions}
Horários: ${aiAgentConfig.businessHours}
Endereço: ${aiAgentConfig.address}
Formas de pagamento: ${aiAgentConfig.paymentMethods}
Regras de agendamento: ${aiAgentConfig.bookingRules}
Políticas: ${aiAgentConfig.policies}
Quando chamar uma pessoa: ${aiAgentConfig.humanHandoff}

BASE DE CONHECIMENTO OPERACIONAL:
${catalogKnowledge}

TABELA ATUAL DE SERVIÇOS E PREÇOS:
${serviceTable}

Regras obrigatórias:
- Responda em português do Brasil.
- Use somente os serviços, preços, durações e informações fornecidas acima.
- Nunca invente preço, promoção, disponibilidade ou política.
- Quando faltar informação, explique com simpatia que não tem esse dado e faça uma única pergunta curta; não encaminhe para uma atendente.
- Para agendar, confirme serviço, data, horário exato e nome, um item por vez; “amanhã” sem horário exige uma pergunta sobre o horário. Só considere confirmado quando a cliente disser explicitamente que quer marcar.
- Só marque handoff true se a cliente pedir explicitamente uma atendente, uma pessoa ou atendimento humano; reclamações, dúvidas clínicas, negociação e falta de informação continuam na conversa.
 - Seja objetiva e acolhedora, com no máximo duas frases curtas.
 - Use humor leve quando combinar e termine com exatamente um emoji discreto. Varie naturalmente entre emojis como 🤎, 😊, 🌿, 💛, 🫶 e ✨; não repita ✨ em quase todas as mensagens e não use emojis no meio da resposta.
 - Varie confirmações e vocativos: não repita “Claro, meu bem” em quase todas as respostas. Alterne expressões como “Sim”, “Com certeza”, “Pode deixar”, “Perfeito” e “Vou te ajudar”, usando “meu bem” apenas quando soar natural.
 - Reassuma o assunto principal da conversa, responda à pergunta atual e não mude de tema sem motivo.
 - Seja sempre simpática e, quando faltar contexto, faça uma única pergunta curta em vez de dar uma resposta genérica.
- Responda em texto simples, sem Markdown, asteriscos ou títulos.`,
        },
        { role: "user", content: message },
      ],
    });
    const reply = response.choices[0]?.message?.content?.replace(/\*\*/g, "").trim()
      || "Não consegui responder agora. Vou encaminhar para uma atendente.";
    res.json(TestAiAgentResponse.parse({ reply }));
  } catch (error) {
    next(error);
  }
});

router.post("/services", (req, res) => {
  const input = CreateServiceBody.parse(req.body);
  const id = services.length ? Math.max(...services.map((item) => item.id)) + 1 : 1;
  const service = { id, ...input };
  services.push(service);
  res.status(201).json(CreateServiceResponse.parse(service));
});

router.patch("/services/:id", (req, res) => {
  const { id } = UpdateServiceParams.parse(req.params);
  const input = UpdateServiceBody.parse(req.body);
  const service = services.find((item) => item.id === id);
  if (!service) return void res.status(404).json({ error: "Serviço não encontrado" });
  Object.assign(service, input);
  res.json(UpdateServiceResponse.parse(service));
});

router.delete("/services/:id", (req, res) => {
  const { id } = DeleteServiceParams.parse(req.params);
  const index = services.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Serviço não encontrado" });
  services.splice(index, 1);
  res.status(204).end();
});

router.get("/quotes", (req, res) => {
  const { search, status, from, to } = ListQuotesQueryParams.parse(req.query);
  const normalized = search?.toLocaleLowerCase("pt-BR");
  const filtered = quotes.filter((quote) =>
    (!normalized || `${quote.number} ${quote.clientName} ${quote.phone}`.toLocaleLowerCase("pt-BR").includes(normalized)) &&
    (!status || quote.status === status) &&
    (!from || quote.createdAt.slice(0, 10) >= from) &&
    (!to || quote.createdAt.slice(0, 10) <= to),
  );
  res.json(ListQuotesResponse.parse(filtered));
});

router.post("/quotes", (req, res) => {
  const input = CreateQuoteBody.parse(req.body);
  const client = clients.find((entry) => entry.id === input.clientId);
  if (!client) return void res.status(400).json({ error: "Cliente não encontrado" });
  const items = input.items.map((item) => {
    const source = item.type === "service" ? services.find((entry) => entry.id === item.refId)
      : item.type === "product" ? inventory.find((entry) => entry.id === item.refId) : item.type === "package" ? packages.find((entry) => entry.id === item.refId) : undefined;
    if (item.refId && !source) throw new Error("Referência do item não encontrada");
    const sourcePrice = source ? (typeof source.price === "string" ? Number(source.price.replace(/[^\d,]/g, "").replace(",", ".")) : source.price) : item.unitPrice;
    const name = source?.name ?? item.name;
    const professional = item.professionalId ? professionals.find((entry) => entry.id === item.professionalId) : undefined;
    return { ...item, name, unitPrice: item.unitPrice ?? sourcePrice, professionalName: professional?.name, commissionPercent: professional?.commissionRate, estimatedCommission: professional ? item.quantity * item.unitPrice * professional.commissionRate / 100 : undefined };
  });
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * Math.max(0, item.unitPrice - (item.discount ?? 0)),
    0,
  );
  const discount = Math.min(input.discountMode === "percent" ? subtotal * input.discountValue / 100 : input.discountValue, subtotal);
  const id = quotes.length > 0 ? Math.max(...quotes.map((quote) => quote.id)) + 1 : 1;
  const quote: Quote = {
    ...input,
    items,
    id,
    number: `ORC-${String(id).padStart(4, "0")}`,
    createdAt: new Date().toISOString(),
    status: "draft",
    publicToken: randomBytes(32).toString("hex"),
    discount,
    subtotal,
    total: Math.max(0, subtotal - discount),
  };
  quotes.unshift(quote);
  res.status(201).json(CreateQuoteResponse.parse(quote));
});

router.patch("/quotes/:id", (req, res) => {
  const { id } = UpdateQuoteParams.parse(req.params);
  const input = UpdateQuoteBody.parse(req.body);
  const quote = quotes.find((item) => item.id === id);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.quantity * Math.max(0, item.unitPrice - (item.discount ?? 0)),
    0,
  );
  const discount = Math.min(input.discountMode === "percent" ? subtotal * input.discountValue / 100 : input.discountValue, subtotal);
  Object.assign(quote, input, {
    discount,
    subtotal,
    total: Math.max(0, subtotal - discount),
  });
  res.json(UpdateQuoteResponse.parse(quote));
});

router.post("/quotes/:id/send", (req, res) => {
  const { id } = SendQuoteParams.parse(req.params);
  const quote = quotes.find((entry) => entry.id === id);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  quote.status = "sent"; quote.sentAt = new Date().toISOString();
  const publicPath = `/proposta/${quote.publicToken}`;
  const whatsappMessage = `Olá, ${quote.clientName}! Preparamos seu orçamento personalizado no SPA. Valor total: ${quote.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. Confira: ${publicPath}`;
  res.json({ quote, publicPath, whatsappMessage, whatsappUrl: `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}` });
});

const publicQuote = (quote: Quote) => ({
  id: quote.id, number: quote.number, clientName: quote.clientName, phone: quote.phone,
  validUntil: quote.validUntil, paymentMethods: quote.paymentMethods, installments: quote.installments,
  items: quote.items.map(({ commissionPercent, estimatedCommission, professionalId, professionalName, ...item }) => item),
  discountMode: quote.discountMode, discountValue: quote.discountValue, discount: quote.discount,
  subtotal: quote.subtotal, total: quote.total, status: quote.status, createdAt: quote.createdAt,
});

router.get("/public/quotes/:token", (req, res) => {
  const { token } = GetPublicQuoteParams.parse(req.params);
  const quote = quotes.find((entry) => entry.publicToken === token);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  if (quote.status === "sent") { quote.status = "viewed"; quote.viewedAt = new Date().toISOString(); }
  res.json(publicQuote(quote));
});

router.post("/public/quotes/:token/approve", (req, res) => {
  const { token } = ApprovePublicQuoteParams.parse(req.params);
  const quote = quotes.find((entry) => entry.publicToken === token);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  if (!["sent", "viewed"].includes(quote.status)) return void res.status(400).json({ error: "Orçamento não pode ser aprovado neste status" });
  if (new Date(quote.validUntil) < new Date()) { quote.status = "expired"; return void res.status(400).json({ error: "Orçamento expirado" }); }
  quote.status = "approved"; quote.approvedAt = new Date().toISOString();
  res.json(quote);
});

router.post("/quotes/:id/cancel", (req, res) => {
  const { id } = CancelQuoteParams.parse(req.params); const quote = quotes.find((entry) => entry.id === id);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  quote.status = "cancelled"; res.json(quote);
});

router.post("/quotes/:id/duplicate", (req, res) => {
  const { id } = DuplicateQuoteParams.parse(req.params); const original = quotes.find((entry) => entry.id === id);
  if (!original) return void res.status(404).json({ error: "Orçamento não encontrado" });
  const copy = { ...original, id: Math.max(...quotes.map((entry) => entry.id)) + 1, number: `ORC-${String(Math.max(...quotes.map((entry) => entry.id)) + 1).padStart(4, "0")}`, createdAt: new Date().toISOString(), status: "draft" as const, publicToken: randomBytes(32).toString("hex"), sentAt: undefined, viewedAt: undefined, approvedAt: undefined, paidAt: undefined, items: original.items.map((item) => ({ ...item })) };
  quotes.unshift(copy); res.status(201).json(copy);
});

router.post("/quotes/:id/appointment", (req, res) => {
  const { id } = CreateQuoteAppointmentParams.parse(req.params);
  const input = CreateQuoteAppointmentBody.parse(req.body);
  const quote = quotes.find((entry) => entry.id === id);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  if (quote.status !== "approved") return void res.status(400).json({ error: "Apenas orçamentos aprovados podem ser agendados" });
  const professional = input.professionalId ? professionals.find((entry) => entry.id === input.professionalId) : undefined;
  if (input.professionalId && !professional) return void res.status(400).json({ error: "Profissional não encontrado" });
  if (appointments.some((entry) => entry.start === input.start && (!professional || entry.professional === professional.name))) return void res.status(409).json({ error: "Este horário não está mais disponível" });
  const item = quote.items.find((entry) => entry.type === "service");
  const appointment: Appointment = { id: Math.max(...appointments.map((entry) => entry.id)) + 1, start: input.start, end: input.end, client: quote.clientName, service: item?.name ?? "Atendimento", professional: professional?.name ?? item?.professionalName ?? "", room: "", status: "confirmed", avatar: getInitials(quote.clientName) };
  appointments.push(appointment); res.status(201).json(appointment);
});

router.post("/quotes/:id/payment", (req, res) => {
  const { id } = CreateQuotePaymentParams.parse(req.params);
  const input = CreateQuotePaymentBody.parse(req.body);
  const quote = quotes.find((entry) => entry.id === id);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  if (quote.status !== "approved") return void res.status(400).json({ error: "Apenas orçamentos aprovados podem receber pagamento" });
  if (quote.paidAt || financialMovements.some((entry) => entry.quoteId === id)) return void res.status(409).json({ error: "Este orçamento já possui pagamento" });
  const movement: FinancialMovement = { id: Math.max(...financialMovements.map((entry) => entry.id)) + 1, type: "revenue", date: new Date().toISOString().slice(0, 10), description: `Pagamento do orçamento ${quote.number}`, category: "Orçamentos", amount: input.amount, status: "paid", client: quote.clientName, service: "", professional: "", quoteId: id, paymentMethod: input.paymentMethod, source: "quote" };
  financialMovements.unshift(movement); quote.paidAt = new Date().toISOString(); res.status(201).json(movement);
});

router.delete("/quotes/:id", (req, res) => {
  const { id } = DeleteQuoteParams.parse(req.params);
  const index = quotes.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Orçamento não encontrado" });
  quotes.splice(index, 1);
  res.status(204).end();
});

router.get("/finance/summary", (_req, res) => {
  res.json(
    GetFinanceSummaryResponse.parse({
      inflow: backup.meta.totalRevenue,
      outflow: 0,
      net: backup.meta.totalRevenue,
      openAccounts: backup.meta.totalOrders,
      newClients: backup.clients.filter((client) => client.orders === 1).length,
      returningClients: backup.clients.filter((client) => client.orders > 1).length,
    }),
  );
});

router.get("/inventory", (req, res) => {
  const { search } = ListInventoryQueryParams.parse(req.query);
  const normalized = search?.trim().toLocaleLowerCase("pt-BR");
  const filtered = normalized
    ? inventory.filter((item) =>
        `${item.name} ${item.brand} ${item.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      )
    : inventory;
  res.json(ListInventoryResponse.parse(filtered));
});

router.post("/inventory", (req, res) => {
  const input = CreateInventoryItemBody.parse(req.body);
  const id = inventory.length ? Math.max(...inventory.map((item) => item.id)) + 1 : 1;
  const item = { id, ...input, status: getInventoryStatus(input.stock, input.minimumStock, input.nextExpiration) };
  inventory.unshift(item);
  res.status(201).json(CreateInventoryItemResponse.parse(item));
});

router.patch("/inventory/:id", (req, res) => {
  const { id } = UpdateInventoryItemParams.parse(req.params);
  const input = UpdateInventoryItemBody.parse(req.body);
  const item = inventory.find((entry) => entry.id === id);
  if (!item) return void res.status(404).json({ error: "Produto não encontrado" });
  Object.assign(item, input, { status: getInventoryStatus(input.stock, input.minimumStock, input.nextExpiration) });
  res.json(UpdateInventoryItemResponse.parse(item));
});

router.delete("/inventory/:id", (req, res) => {
  const { id } = DeleteInventoryItemParams.parse(req.params);
  const index = inventory.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Produto não encontrado" });
  inventory.splice(index, 1);
  res.status(204).end();
});

router.get("/professionals/:id/commission-config", (req, res) => {
  const { id } = GetProfessionalCommissionConfigParams.parse(req.params);
  if (!professionals.some((professional) => professional.id === id)) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
  let config = commissionConfigs.get(id);
  if (!config) {
    const professional = professionals.find((entry) => entry.id === id)!;
    config = {
      professionalId: id,
      commissionType: "percent",
      defaultValue: professional.commissionRate,
      calculationBase: "gross",
      discountInCalculation: false,
      cardFeeInCalculation: false,
      cancellationsGenerate: false,
      productsGenerate: false,
      productCommissionPercent: 0,
      updatedAt: new Date().toISOString(),
    };
    commissionConfigs.set(id, config);
  }
  res.json(GetProfessionalCommissionConfigResponse.parse(config));
});

router.put("/professionals/:id/commission-config", (req, res) => {
  const { id } = UpdateProfessionalCommissionConfigParams.parse(req.params);
  const input = UpdateProfessionalCommissionConfigBody.parse(req.body);
  if (!professionals.some((professional) => professional.id === id)) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
  const before = commissionConfigs.get(id) ?? null;
  const config: CommissionConfig = { professionalId: id, ...input, updatedAt: new Date().toISOString() };
  commissionConfigs.set(id, config);
  const professional = professionals.find((entry) => entry.id === id);
  if (professional && input.commissionType === "percent") professional.commissionRate = input.defaultValue;
  audit("config", id, null, res.locals.session?.username ?? "unknown", before, config);
  res.json(UpdateProfessionalCommissionConfigResponse.parse(config));
});

router.get("/professionals/:id/commission-rules", (req, res) => {
  const { id } = ListCommissionRulesParams.parse(req.params);
  if (!professionals.some((professional) => professional.id === id)) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
  res.json(ListCommissionRulesResponse.parse(commissionRules.filter((rule) => rule.professionalId === id)));
});

router.post("/professionals/:id/commission-rules", (req, res) => {
  const { id } = CreateCommissionRuleParams.parse(req.params);
  const input = CreateCommissionRuleBody.parse(req.body);
  if (!professionals.some((professional) => professional.id === id)) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
  if (!services.some((service) => service.id === input.serviceId)) {
    res.status(400).json({ error: "Serviço não encontrado" });
    return;
  }
  const service = services.find((entry) => entry.id === input.serviceId)!;
  const duplicate = commissionRules.find((rule) => rule.professionalId === id && rule.serviceId === input.serviceId);
  if (duplicate) {
    res.status(409).json({ error: "Já existe uma regra para este serviço" });
    return;
  }
  const rule: CommissionRule = {
    id: commissionRules.length ? Math.max(...commissionRules.map((entry) => entry.id)) + 1 : 1,
    professionalId: id,
    ...input,
    serviceName: service.name,
  };
  commissionRules.push(rule);
  res.status(201).json(CreateCommissionRuleResponse.parse(rule));
});

router.patch("/professionals/:id/commission-rules/:ruleId", (req, res) => {
  const { id, ruleId } = UpdateCommissionRuleParams.parse(req.params);
  const input = UpdateCommissionRuleBody.parse(req.body);
  const rule = commissionRules.find((entry) => entry.id === ruleId && entry.professionalId === id);
  if (!rule) {
    res.status(404).json({ error: "Regra de comissão não encontrada" });
    return;
  }
  const service = services.find((entry) => entry.id === input.serviceId);
  if (!service) {
    res.status(400).json({ error: "Serviço não encontrado" });
    return;
  }
  const duplicate = commissionRules.find((entry) => entry.id !== ruleId && entry.professionalId === id && entry.serviceId === input.serviceId);
  if (duplicate) {
    res.status(409).json({ error: "Já existe uma regra para este serviço" });
    return;
  }
  Object.assign(rule, input, { serviceName: service.name });
  res.json(UpdateCommissionRuleResponse.parse(rule));
});

router.delete("/professionals/:id/commission-rules/:ruleId", (req, res) => {
  const { id, ruleId } = DeleteCommissionRuleParams.parse(req.params);
  const index = commissionRules.findIndex((entry) => entry.id === ruleId && entry.professionalId === id);
  if (index < 0) {
    res.status(404).json({ error: "Regra de comissão não encontrada" });
    return;
  }
  commissionRules.splice(index, 1);
  res.status(204).end();
});

router.get("/commissions/items", (req, res) => {
  const query = ListCommissionItemsQueryParams.parse(req.query);
  const items = getCommissionItems(query.from, query.to, query.professionalId)
    .filter((item) => !query.status || item.status === query.status);
  res.json(ListCommissionItemsResponse.parse(items));
});

router.get("/commissions/items/:id", (req, res) => {
  const { id } = GetCommissionItemParams.parse(req.params);
  const item = getCommissionItems("0000-01-01", "9999-12-31").find((entry) => entry.id === id);
  if (!item) {
    res.status(404).json({ error: "Item de comissão não encontrado" });
    return;
  }
  res.json(GetCommissionItemResponse.parse(item));
});

router.get("/commissions/summary", (req, res) => {
  const query = GetCommissionsSummaryQueryParams.parse(req.query);
  const items = getCommissionItems(query.from, query.to, query.professionalId)
    .filter((item) => !query.status || item.status === query.status);
  const eligibleAmount = items.reduce((sum, item) => sum + (item.commissionAmount ?? 0), 0);
  res.json(GetCommissionsSummaryResponse.parse({
    from: query.from,
    to: query.to,
    professionalId: query.professionalId ?? null,
    totalAmount: eligibleAmount,
    eligibleAmount,
    blockedCount: items.filter((item) => item.status === "blocked").length,
    itemCount: items.length,
    items,
  }));
});

router.get("/commissions/closures", (req, res) => {
  const query = ListCommissionClosuresQueryParams.parse(req.query);
  const result = commissionClosures.filter((closure) =>
    (!query.professionalId || closure.professionalId === query.professionalId) &&
    (!query.from || closure.from >= query.from) &&
    (!query.to || closure.to <= query.to) &&
    (!query.status || closure.status === query.status),
  );
  res.json(ListCommissionClosuresResponse.parse(result));
});

router.post("/commissions/closures/close", (req, res) => {
  const input = CloseCommissionPeriodBody.parse(req.body);
  const professional = professionals.find((entry) => entry.id === input.professionalId);
  if (!professional) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
  if (input.from > input.to) {
    res.status(400).json({ error: "Período inválido" });
    return;
  }
  let closure = commissionClosures.find((entry) =>
    entry.professionalId === input.professionalId && entry.from === input.from && entry.to === input.to,
  );
  if (closure?.status === "paid" || closure?.status === "closed") {
    res.json(CloseCommissionPeriodResponse.parse(closure));
    return;
  }
  const before = closure ? clone(closure) : null;
  const items = getCommissionItems(input.from, input.to, input.professionalId)
    .filter((item) => item.professionalId === input.professionalId);
  const snapshots = items.map((item) => item.status === "eligible" ? { ...clone(item), status: "closed" as const } : clone(item));
  const totalAmount = snapshots.reduce((sum, item) => sum + (item.commissionAmount ?? 0), 0);
  if (!closure) {
    closure = {
      id: commissionClosures.length ? Math.max(...commissionClosures.map((entry) => entry.id)) + 1 : 1,
      professionalId: input.professionalId,
      professionalName: professional.name,
      from: input.from,
      to: input.to,
      dueDate: input.dueDate,
      status: "open",
      totalAmount: 0,
      itemIds: [],
      itemSnapshots: [],
      financialMovementId: null,
      closedAt: null,
      paidAt: null,
      paymentDate: null,
      paymentMethod: null,
      paymentNote: null,
    };
    commissionClosures.push(closure);
  }
  let movement = closure.financialMovementId
    ? financialMovements.find((entry) => entry.id === closure!.financialMovementId)
    : undefined;
  if (!movement) {
    movement = {
      id: financialMovements.length ? Math.max(...financialMovements.map((entry) => entry.id)) + 1 : 1,
      type: "expense",
      date: input.dueDate,
      description: `Comissões de ${professional.name} (${input.from} a ${input.to})`,
      category: "Comissões",
      amount: totalAmount,
      status: "pending",
      client: "",
      service: "",
      professional: professional.name,
      source: "commission_closure",
      sourceId: closure.id,
    };
    financialMovements.unshift(movement);
    closure.financialMovementId = movement.id;
  } else {
    Object.assign(movement, { amount: totalAmount, status: "pending" as const, date: input.dueDate, professional: professional.name });
  }
  Object.assign(closure, {
    status: "closed" as const,
    dueDate: input.dueDate,
    totalAmount,
    itemIds: snapshots.map((item) => item.id),
    itemSnapshots: snapshots,
    closedAt: new Date().toISOString(),
  });
  audit("close", input.professionalId, closure.id, res.locals.session?.username ?? "unknown", before, closure);
  res.json(CloseCommissionPeriodResponse.parse(closure));
});

router.post("/commissions/closures/:id/reopen", (req, res) => {
  const { id } = ReopenCommissionPeriodParams.parse(req.params);
  const closure = commissionClosures.find((entry) => entry.id === id);
  if (!closure) {
    res.status(404).json({ error: "Fechamento não encontrado" });
    return;
  }
  if (closure.status === "paid") {
    res.status(409).json({ error: "Fechamento pago não pode ser reaberto" });
    return;
  }
  if (closure.status !== "closed") {
    res.status(409).json({ error: "Somente fechamentos fechados podem ser reabertos" });
    return;
  }
  const before = clone(closure);
  closure.status = "open";
  closure.closedAt = null;
  audit("reopen", closure.professionalId, closure.id, res.locals.session?.username ?? "unknown", before, closure);
  res.json(ReopenCommissionPeriodResponse.parse(closure));
});

router.post("/commissions/closures/:id/pay", (req, res) => {
  const { id } = PayCommissionPeriodParams.parse(req.params);
  const input = PayCommissionPeriodBody.parse(req.body);
  const closure = commissionClosures.find((entry) => entry.id === id);
  if (!closure) {
    res.status(404).json({ error: "Fechamento não encontrado" });
    return;
  }
  if (closure.status !== "closed") {
    res.status(409).json({ error: "Somente fechamentos fechados podem ser pagos" });
    return;
  }
  const movement = closure.financialMovementId
    ? financialMovements.find((entry) => entry.id === closure.financialMovementId)
    : undefined;
  if (!movement) {
    res.status(409).json({ error: "Movimentação financeira do fechamento não encontrada" });
    return;
  }
  const before = clone(closure);
  Object.assign(closure, {
    status: "paid" as const,
    paidAt: new Date().toISOString(),
    paymentDate: input.paymentDate,
    paymentMethod: input.paymentMethod,
    paymentNote: input.note,
  });
  Object.assign(movement, {
    status: "paid" as const,
    paymentDate: input.paymentDate,
    paymentMethod: input.paymentMethod,
    paymentNote: input.note,
  });
  audit("pay", closure.professionalId, closure.id, res.locals.session?.username ?? "unknown", before, closure);
  res.json(PayCommissionPeriodResponse.parse(closure));
});

router.get("/commissions/audit", (req, res) => {
  const query = ListCommissionAuditQueryParams.parse(req.query);
  const result = commissionAudit.filter((entry) =>
    (!query.professionalId || entry.professionalId === query.professionalId) &&
    (!query.closureId || entry.closureId === query.closureId),
  );
  res.json(ListCommissionAuditResponse.parse(result));
});

export default router;