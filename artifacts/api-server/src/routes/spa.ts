import { Router, type IRouter, type Request, type Response } from "express";
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
  ListStaffAccessAccountsResponse,
  CreateStaffAccessAccountBody,
  CreateStaffAccessAccountResponse,
  UpdateStaffAccessAccountParams,
  UpdateStaffAccessAccountBody,
  UpdateStaffAccessAccountResponse,
  ResetStaffAccessPasswordParams,
  ResetStaffAccessPasswordResponse,
  ListCommissionAuditQueryParams,
  ListCommissionAuditResponse,
  ListArchivedRecordsResponse,
  ManageArchivedRecordsBody,
  ManageArchivedRecordsResponse,
} from "@workspace/api-zod";
import {
  db,
  staffAccessAccountsTable,
  whatsappConversationsTable,
  whatsappFollowupsTable,
  whatsappMessagesTable,
  whatsappSettingsTable,
} from "@workspace/db";
import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ensureCompatibleFormat, speechToText } from "@workspace/integrations-openai-ai-server/audio";
import backup from "../data/spa-backup.json";
import { logger } from "../lib/logger";
import { defaultStaffPasswordFromEmail } from "../lib/staff-access-password";
import { sendStaffAccessCredentialsEmail } from "../lib/resend-email";
import {
  createPasswordRecord,
  generateTemporaryPassword,
  getAdminUsername,
  isStaffSpaRequestAllowed,
  requireSession,
  type AuthenticatedSession,
} from "../lib/auth";
import { createSpaOperationalStateStore } from "../lib/spa-state-store";
import {
  acquireSpaOperationalStateLock,
  spaOperationalStateRepository,
} from "../lib/spa-state-repository";
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
router.use((req, res, next) => {
  const session = res.locals.session as AuthenticatedSession | undefined;
  if (!session || isStaffSpaRequestAllowed(session, req.method, req.path)) {
    next();
    return;
  }
  res.status(403).json({ error: "Seu acesso não permite esta área." });
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
  professionalId: number | null;
  room: string;
  status: AppointmentStatus;
  attendance: "pending" | "attended" | "no_show";
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

const emptyWeeklySchedule = (): Professional["weeklySchedule"] =>
  Array.from({ length: 7 }, (_, weekday) => ({ weekday, enabled: false, intervals: [] }));

const validScheduleIntervals = (intervals: Professional["weeklySchedule"][number]["intervals"]) => {
  if (intervals.some((interval) =>
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.start) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(interval.end) ||
    interval.start >= interval.end,
  )) return false;
  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.every((interval, index) => index === 0 || sorted[index - 1]!.end <= interval.start);
};

const professionalScheduleError = (professional: Pick<Professional, "weeklySchedule" | "scheduleExceptions">) => {
  const weekdays = new Set(professional.weeklySchedule.map((day) => day.weekday));
  if (professional.weeklySchedule.length !== 7 || weekdays.size !== 7 ||
      professional.weeklySchedule.some((day) =>
        day.weekday < 0 || day.weekday > 6 || !validScheduleIntervals(day.intervals),
      )) {
    return "A grade semanal precisa ter sete dias e horários válidos, sem turnos sobrepostos.";
  }

  const dates = new Set<string>();
  for (const exception of professional.scheduleExceptions) {
    const parsedDate = new Date(`${exception.date}T00:00:00Z`);
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(exception.date) &&
      !Number.isNaN(parsedDate.getTime()) &&
      parsedDate.toISOString().slice(0, 10) === exception.date;
    if (!dateIsValid || dates.has(exception.date)) {
      return "Cada exceção precisa ter uma data válida e única.";
    }
    dates.add(exception.date);
    if (!validScheduleIntervals(exception.intervals) ||
        (exception.type === "day_off" && exception.intervals.length > 0) ||
        (exception.type === "custom_hours" && exception.intervals.length === 0)) {
      return "Confira os horários das exceções e folgas cadastradas.";
    }
  }
  return null;
};

const appointments: Appointment[] = [
  {
    id: 1,
    start: "09:00",
    end: "10:00",
    client: "Ana Martins",
    service: "Massagem Relaxante",
    professional: "Marina",
    professionalId: 1,
    room: "Sala 02",
    status: "in_progress",
    attendance: "pending",
    avatar: "AM",
  },
  {
    id: 2,
    start: "10:30",
    end: "11:20",
    client: "Mariana Costa",
    service: "Drenagem Linfática",
    professional: "Paula",
    professionalId: 2,
    room: "Sala 01",
    status: "confirmed",
    attendance: "pending",
    avatar: "MC",
  },
  {
    id: 3,
    start: "11:30",
    end: "12:45",
    client: "Juliana Alves",
    service: "Ritual Facial",
    professional: "Rosana",
    professionalId: 3,
    room: "Sala 03",
    status: "confirmed",
    attendance: "pending",
    avatar: "JA",
  },
  {
    id: 4,
    start: "14:00",
    end: "15:00",
    client: "Carlos Almeida",
    service: "Massagem Terapêutica",
    professional: "Wallace",
    professionalId: 4,
    room: "Sala 02",
    status: "confirmed",
    attendance: "pending",
    avatar: "CA",
  },
  {
    id: 5,
    start: "15:30",
    end: "16:10",
    client: "Beatriz Lima",
    service: "Bronzeamento em máquina",
    professional: "Paula",
    professionalId: 2,
    room: "Bronze 01",
    status: "confirmed",
    attendance: "pending",
    avatar: "BL",
  },
];

const professionals: Professional[] = [
  { id: 1, name: "Marina", specialty: "Massagens e terapias", phone: "", email: "", commissionRate: 20, active: true, weeklySchedule: emptyWeeklySchedule(), scheduleExceptions: [] },
  { id: 2, name: "Paula", specialty: "Drenagem e tratamentos corporais", phone: "", email: "", commissionRate: 18, active: true, weeklySchedule: emptyWeeklySchedule(), scheduleExceptions: [] },
  { id: 3, name: "Rosana", specialty: "Estética facial", phone: "", email: "", commissionRate: 20, active: true, weeklySchedule: emptyWeeklySchedule(), scheduleExceptions: [] },
  { id: 4, name: "Wallace", specialty: "Massoterapia", phone: "", email: "", commissionRate: 15, active: true, weeklySchedule: emptyWeeklySchedule(), scheduleExceptions: [] },
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
  followUp30m: true,
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
const normalizeCatalogLabel = (value: string) =>
  normalizeName(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ");
const requestSession = (res: Response) => res.locals.session as AuthenticatedSession;
const disableStaffAccessForProfessional = async (professionalId: number) => {
  await db
    .update(staffAccessAccountsTable)
    .set({
      active: false,
      sessionVersion: sql`${staffAccessAccountsTable.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(staffAccessAccountsTable.professionalId, professionalId));
};
const appointmentBelongsToProfessional = (appointment: Appointment, professionalId: number) => {
  const professional = professionals.find((item) => item.id === professionalId);
  return appointment.professionalId === professionalId ||
    (appointment.professionalId == null &&
      Boolean(professional) &&
      normalizeName(appointment.professional) === normalizeName(professional!.name));
};
const findClientForAppointment = (appointment: Appointment) =>
  clients.find((client) => normalizeName(client.name) === normalizeName(appointment.client));

const localAgendaDate = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: whatsappAutomation.timezone }).format(new Date());

const agendaLocalDateTime = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[T ]([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "00"] = match;
  const parts = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const [year, month, day, hour, minute, second] = parts;
  const localTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const normalized = new Date(localTimestamp);
  if (
    normalized.getUTCFullYear() !== year ||
    normalized.getUTCMonth() !== month - 1 ||
    normalized.getUTCDate() !== day ||
    normalized.getUTCHours() !== hour ||
    normalized.getUTCMinutes() !== minute ||
    normalized.getUTCSeconds() !== second
  ) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: whatsappAutomation.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let timestamp = localTimestamp;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const formattedParts = Object.fromEntries(
      formatter
        .formatToParts(new Date(timestamp))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    ) as Record<string, number>;
    const representedLocalTimestamp = Date.UTC(
      formattedParts["year"],
      formattedParts["month"] - 1,
      formattedParts["day"],
      formattedParts["hour"],
      formattedParts["minute"],
      formattedParts["second"],
    );
    const correction = localTimestamp - representedLocalTimestamp;
    if (correction === 0) return new Date(timestamp);
    timestamp += correction;
  }
  return null;
};

const formatAgendaDateTime = (date: Date) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: whatsappAutomation.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}T${parts["hour"]}:${parts["minute"]}`;
};

const appointmentDateTimeInAgenda = (start: string, agendaDate = localAgendaDate()): Date | null => {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(start)) {
    const zonedDateTime = new Date(start);
    return Number.isNaN(zonedDateTime.getTime()) ? null : zonedDateTime;
  }
  const localDateTime = agendaLocalDateTime(start);
  if (localDateTime) return localDateTime;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(start)) return null;
  const time = start.length === 5 ? `${start}:00` : start;
  return agendaLocalDateTime(`${agendaDate}T${time}`);
};

const formatAppointmentDate = (appointment: Appointment) => {
  const date = appointmentDateTimeInAgenda(appointment.start);
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: whatsappAutomation.timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
};

const appointmentOperationalDetails = (includeHours: boolean) => {
  const configuredHours = aiAgentConfig.businessHours.trim();
  const address = aiAgentConfig.address.trim();
  const normalizedAddress = normalizeCatalogLabel(address);
  const isOnlyCityAndState = /^belem(?:\s*[-,]\s*(?:pa|para))?$/.test(normalizedAddress);
  const details = [
    includeHours && configuredHours ? `Funcionamos ${configuredHours}.` : null,
    address && !isOnlyCityAndState ? `Endereço: ${address}.` : null,
  ].filter((detail): detail is string => Boolean(detail));
  return details.join(" ");
};

const appointmentScheduledReply = (appointment: Appointment) => {
  const formattedDate = formatAppointmentDate(appointment) ?? appointment.start;
  const professional = appointment.professional ? `, com ${appointment.professional}` : "";
  const details = appointmentOperationalDetails(true);
  return `Pronto! Seu atendimento de ${appointment.service} ficou agendado para ${formattedDate}${professional}.${details ? ` ${details}` : ""} 🤎`;
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

const saveWhatsappClientName = async (phone: string, reportedName: string | null) => {
  const clientName = reportedName?.trim().replace(/\s+/g, " ") ?? "";
  if (
    clientName.length < 2 ||
    clientName.length > 60 ||
    !/\p{L}/u.test(clientName) ||
    /\d/.test(clientName) ||
    normalizeWhatsappPhone(clientName) === normalizeWhatsappPhone(phone)
  ) return;

  const conversation = await getWhatsappConversation(phone);
  if (!conversation) return;
  const storedNameIsPhone = normalizeWhatsappPhone(conversation.clientName) === conversation.phone;
  if (!storedNameIsPhone && normalizeName(conversation.clientName) !== normalizeName(clientName)) return;
  const normalizedReportedName = normalizeCatalogLabel(clientName);
  const inboundMessages = await db
    .select({ text: whatsappMessagesTable.text })
    .from(whatsappMessagesTable)
    .where(and(
      eq(whatsappMessagesTable.conversationId, conversation.id),
      eq(whatsappMessagesTable.direction, "inbound"),
    ))
    .orderBy(desc(whatsappMessagesTable.createdAt))
    .limit(12);
  const escapedName = normalizedReportedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const explicitNamePattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapedName}(?:$|[^\\p{L}\\p{N}])`, "u");
  if (!inboundMessages.some((message) => explicitNamePattern.test(normalizeCatalogLabel(message.text)))) return;

  await db.transaction(async (tx) => {
    await tx
      .update(whatsappConversationsTable)
      .set({ clientName, updatedAt: new Date() })
      .where(eq(whatsappConversationsTable.id, conversation.id));
    await tx
      .update(whatsappMessagesTable)
      .set({ clientName })
      .where(and(
        eq(whatsappMessagesTable.conversationId, conversation.id),
        eq(whatsappMessagesTable.clientName, conversation.clientName),
      ));
  });
};

const addWhatsappMessage = async (message: Omit<WhatsappMessage, "id" | "createdAt">) => {
  const conversation = await ensureWhatsappConversation(message.phone, message.clientName);
  const providedClientName = message.clientName.trim();
  const providedNameIsPhone = normalizeWhatsappPhone(providedClientName) === conversation.phone;
  const clientName = !providedClientName || providedNameIsPhone
    ? conversation.clientName
    : providedClientName;
  const [created] = await db
    .insert(whatsappMessagesTable)
    .values({
      conversationId: conversation.id,
      direction: message.direction,
      phone: message.phone,
      clientName,
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
      clientName,
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
  const professional = appointment.professional ? `, com ${appointment.professional}` : "";
  const operationalDetails = appointmentOperationalDetails(kind === "confirmation");
  if (kind === "confirmation") {
    return `Olá, ${appointment.client}! Seu atendimento de ${appointment.service} está reservado para ${formattedDate}${professional}.${operationalDetails ? ` ${operationalDetails}` : ""} Responda CONFIRMAR para confirmar, REMARCAR para escolher outro horário ou CANCELAR para cancelar.`;
  }
  if (kind === "reminder24h") {
    return `Olá, ${appointment.client}! Lembrando que seu atendimento de ${appointment.service} será amanhã: ${formattedDate}${professional}.${operationalDetails ? ` ${operationalDetails}` : ""} Responda CONFIRMAR para confirmar sua presença.`;
  }
  return `Olá, ${appointment.client}! Seu atendimento de ${appointment.service} começa em aproximadamente 2 horas: ${formattedDate}${professional}.${operationalDetails ? ` ${operationalDetails}` : ""} Estamos esperando você.`;
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

const followUpMessageForAgentQuestion =
  "Vim só dar um alô antes que a nossa conversa peça férias. Se ainda quiser, me conta como posso te ajudar 😄";

const replyEndsWithQuestion = (text: string) => {
  const withoutFinalEmoji = text.trim()
    .replace(/[\s\p{Extended_Pictographic}\uFE0F\u200D]+$/gu, "")
    .trim();
  return withoutFinalEmoji.endsWith("?");
};

const scheduleWhatsappFollowUp = async (phone: string, triggerMessage: WhatsappMessage) => {
  if (
    !whatsappAutomation.enabled ||
    !whatsappAutomation.aiReplies ||
    !whatsappAutomation.followUp30m ||
    !aiAgentConfig.active ||
    triggerMessage.status !== "sent" ||
    !replyEndsWithQuestion(triggerMessage.text)
  ) return;

  const conversation = await getWhatsappConversation(phone);
  if (!conversation || conversation.status !== "agent") return;

  await db
    .insert(whatsappFollowupsTable)
    .values({
      conversationId: conversation.id,
      triggerMessageId: triggerMessage.id,
      dueAt: new Date(Date.now() + 30 * 60_000),
      status: "pending",
    })
    .onConflictDoNothing({ target: whatsappFollowupsTable.triggerMessageId });
};

const sendWhatsappAgentReply = async (
  phone: string,
  clientName: string,
  appointmentId: number | null,
  text: string,
  replyTo?: EvolutionReplyReference,
) => {
  const message = await sendWhatsappReply(phone, clientName, appointmentId, text, "reply", replyTo);
  try {
    await scheduleWhatsappFollowUp(phone, message);
  } catch (error) {
    logger.error({ err: error, phone, messageId: message.id }, "WhatsApp follow-up scheduling failed");
  }
  return message;
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
  confirmed: boolean;
};

type AgentDecision = {
  reply: string;
  clientName: string | null;
  handoff: boolean;
  document: WhatsappDocument | null;
  audioClip: WhatsappAudioClip | null;
  appointment: AgentAppointmentDraft | null;
  appointmentDataInvalid: boolean;
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
    const rawAppointment = value.appointment;
    const document = value.document === "menu" || value.document === "advanced"
      ? value.document
      : null;
    const audioClip = value.audioClip === "combos" || value.audioClip === "bronze"
      ? value.audioClip
      : null;
    const parsedClientName = typeof value.clientName === "string" ? value.clientName.trim() : "";
    const clientName = parsedClientName && parsedClientName.toLocaleLowerCase("pt-BR") !== "null"
      ? parsedClientName
      : null;
    let appointment: AgentAppointmentDraft | null = null;
    let appointmentDataInvalid = false;
    if (rawAppointment !== null && rawAppointment !== undefined) {
      if (typeof rawAppointment !== "object" || Array.isArray(rawAppointment)) {
        appointmentDataInvalid = true;
      } else {
        const raw = rawAppointment as Record<string, unknown>;
        if (
          (raw.clientName !== undefined && raw.clientName !== null && typeof raw.clientName !== "string") ||
          typeof raw.service !== "string" ||
          typeof raw.start !== "string" ||
          typeof raw.confirmed !== "boolean" ||
          (raw.professional !== undefined && raw.professional !== null && typeof raw.professional !== "string")
        ) {
          appointmentDataInvalid = true;
        } else {
          const parsedAppointment: AgentAppointmentDraft = {
            clientName: typeof raw.clientName === "string" ? raw.clientName.trim() : "",
            service: raw.service.trim(),
            professional: typeof raw.professional === "string" ? raw.professional.trim() : "",
            start: raw.start.trim(),
            confirmed: raw.confirmed,
          };
          if (!parsedAppointment.service || !parsedAppointment.start) {
            appointmentDataInvalid = true;
          } else {
            appointment = parsedAppointment;
          }
        }
      }
    }
    const reply = typeof value.reply === "string" ? value.reply.replace(/\*\*/g, "").trim() : "";
    if (!reply) throw new Error("O agente retornou um JSON sem reply");
    return {
      reply,
      clientName,
      handoff: value.handoff === true,
      document,
      audioClip,
      appointment,
      appointmentDataInvalid,
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
  const serviceTable = activeSpaRecords("service", services)
    .map((service) => `- ${service.name} | ${service.category} | ${service.duration} | ${service.price}`)
    .join("\n");
  const professionalTable = activeSpaRecords("professional", professionals)
    .filter((professional) => professional.active)
    .map((professional) => `- ${professional.name}`)
    .join("\n");
  const currentDate = new Intl.DateTimeFormat("sv-SE", {
    timeZone: whatsappAutomation.timezone,
  }).format(new Date());
  const response = await openai.chat.completions.create({
    model: OPENAI_TEXT_MODEL,
    max_completion_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é ${aiAgentConfig.name}, atendente do Spa e Bronze Belém.
Responda em português do Brasil, com tom ${aiAgentConfig.tone}, de forma muito curta, natural e acolhedora.
Nome conhecido do cliente: ${clientName !== phone ? clientName : "ainda não informado"}.
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

PROFISSIONAIS ATIVOS:
${professionalTable || "- Nenhum profissional cadastrado"}

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
- Se perguntarem se você é IA, robô ou pessoa, responda com transparência que é a assistente virtual com IA do Spa e Bronze Belém; nunca afirme ou sugira que é humana.
- Se o pedido não tiver relação com o Spa e Bronze Belém, não responda ao conteúdo aleatório nem execute pedidos externos; explique brevemente que seu atendimento é sobre serviços, valores, horários e agendamentos do Spa e redirecione com uma pergunta curta.
- Se a mensagem vier com uma imagem, observe-a antes de responder e use apenas o que estiver visível nela. Se vier de áudio, considere a transcrição como a mensagem da cliente.
- Se a cliente fizer uma pergunta de continuação, responda diretamente a ela sem repetir toda a apresentação. Se faltar informação, faça uma única pergunta curta para esclarecer.
- Mantenha-se simpática, paciente e acolhedora em todas as respostas. Não use respostas genéricas quando houver contexto suficiente.
- ${isFirstClientMessage ? "Esta é a primeira mensagem do cliente. Comece a resposta usando a saudação configurada, sem trocar por uma mensagem genérica de encaminhamento." : "Não repita a saudação configurada em todas as mensagens."}
- Nunca peça o nome na primeira resposta, junto da saudação inicial. Depois que a cliente já recebeu essa resposta e continuar a conversa, se o nome ainda não for conhecido, pergunte-o com naturalidade em uma pergunta curta; não repita o pedido e não deixe de responder à dúvida principal.
- Ao retornar clientName, use somente o nome que a cliente informou explicitamente na conversa; se ainda não informou, retorne null. Nunca deduza o nome pelo telefone.
- Não invente preços, promoções, horários, contraindicações ou resultados.
- Quando perguntarem sobre funcionamento, localização ou endereço, responda usando os campos configurados acima. Ao confirmar um agendamento, informe também o horário de funcionamento e o endereço completo cadastrado; não trate apenas “Belém - PA” como endereço nem invente complemento.
- Procedimentos estéticos avançados não devem receber diagnóstico ou indicação clínica; explique esse limite com simpatia e faça uma pergunta curta, sem encaminhar para uma atendente.
- Para agendar, conduza a cliente passo a passo: confirme serviço, data, horário exato e nome, perguntando apenas o próximo item que faltar. “Amanhã” sem horário não é confirmação; pergunte qual horário ela prefere. Só crie appointment depois de confirmação explícita e sempre envie uma resposta curta.
- No appointment, use exatamente o nome de um serviço cadastrado e o nome de um profissional ativo; deixe professional vazio se a cliente não tiver preferência. Nunca invente nomes.
- Use start como data ISO local completa (AAAA-MM-DDTHH:mm), no fuso informado, somente quando a cliente tiver informado data e horário exatos e confirmado que deseja agendar.
- Não envie end: o sistema calcula o término usando a duração cadastrada do serviço.
- Consulte a AGENDA ATUAL antes de propor ou confirmar um horário. Nunca crie appointment em um horário ocupado; se houver conflito, explique que o horário não está disponível e peça outra opção.
- Nunca marque appointment quando faltar serviço, data, horário ou confirmação explícita.
- Se o cliente pedir o cardápio geral, use document "menu". Se pedir estética avançada, use document "advanced". Caso contrário, document deve ser null.
- Há dois áudios pré-gravados disponíveis para enviar junto com uma mensagem de texto:
  - audioClip "combos": gravação que explica os combos do Spa e Bronze.
  - audioClip "bronze": gravação sobre bronzeamento.
  Escolha um somente se o pedido atual da cliente for diretamente sobre esse tema e a gravação for pertinente; nos demais casos use null. Se escolher um áudio, a resposta escrita deve ser apenas uma introdução curta ao áudio, sem inventar preços ou detalhes que não estejam confirmados.
- Só marque handoff true se a cliente pedir explicitamente uma atendente, uma pessoa ou atendimento humano. Reclamações, negociação, dúvidas clínicas, falta de informação e reagendamento continuam na conversa.
- Retorne SOMENTE um JSON válido, sem Markdown, neste formato:
{"reply":"texto curto","clientName":null,"handoff":false,"document":null,"audioClip":null,"appointment":null}
ou, quando houver agendamento confirmado:
 {"reply":"texto curto","clientName":null,"handoff":false,"document":null,"audioClip":null,"appointment":{"clientName":"nome informado","service":"nome exato do serviço","professional":"","start":"AAAA-MM-DDTHH:mm","confirmed":true}}. Se a cliente informou o nome, retorne-o como string em clientName; caso contrário, mantenha null.`,
      },
      ...(await getConversationHistory(phone)).slice(0, -1),
      { role: "user", content: currentInput },
    ],
  });
  return parseAgentDecision(response.choices[0]?.message?.content ?? "");
};

type AppointmentSlotCandidate = {
  start: string;
  end: string;
  professional: string;
  professionalId?: number | null;
};
type AppointmentSlotIssue = "invalid" | "conflict";
type AgentAppointmentFailure =
  | "invalid_data"
  | "invalid_service"
  | "invalid_professional"
  | "invalid_datetime"
  | "missing_client_name"
  | "conflict";
type AgentAppointmentResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; reason: AgentAppointmentFailure };

const appointmentBlocksTime = (appointment: Appointment) =>
  appointment.status === "confirmed" || appointment.status === "in_progress";

const appointmentSlotIssue = (
  candidate: AppointmentSlotCandidate,
  excludedAppointmentId?: number,
): AppointmentSlotIssue | null => {
  const agendaDate = localAgendaDate();
  const start = appointmentDateTimeInAgenda(candidate.start, agendaDate)?.getTime();
  const end = appointmentDateTimeInAgenda(candidate.end, agendaDate)?.getTime();
  if (start == null || end == null || end <= start) return "invalid";

  const selectedProfessional = candidate.professionalId != null
    ? activeSpaRecords("professional", professionals).find((professional) => professional.id === candidate.professionalId)
    : activeSpaRecords("professional", professionals).find((professional) =>
        normalizeName(professional.name) === normalizeName(candidate.professional),
      );
  if (selectedProfessional) {
    const localStart = formatAgendaDateTime(new Date(start));
    const localEnd = formatAgendaDateTime(new Date(end));
    const localDate = localStart.slice(0, 10);
    const weekday = new Date(`${localDate}T00:00:00Z`).getUTCDay();
    const exception = selectedProfessional.scheduleExceptions.find((item) => item.date === localDate);
    const intervals = exception
      ? exception.type === "day_off" ? [] : exception.intervals
      : selectedProfessional.weeklySchedule.find((item) => item.weekday === weekday && item.enabled)?.intervals ?? [];
    const startsAt = localStart.slice(11, 16);
    const endsAt = localEnd.slice(11, 16);
    const insideAvailability = localEnd.slice(0, 10) === localDate &&
      intervals.some((interval) => interval.start <= startsAt && interval.end >= endsAt);
    if (!insideAvailability) return "conflict";
  }

  const conflict = activeSpaRecords("appointment", appointments).some((appointment) => {
    if (
      appointment.id === excludedAppointmentId ||
      !appointmentBlocksTime(appointment)
    ) {
      return false;
    }
    const existingStart = appointmentDateTimeInAgenda(appointment.start, agendaDate)?.getTime();
    const existingEnd = appointmentDateTimeInAgenda(appointment.end, agendaDate)?.getTime();
    if (existingStart == null || existingEnd == null) return false;
    const existingProfessionalId = appointment.professionalId ??
      professionals.find((professional) => normalizeName(professional.name) === normalizeName(appointment.professional))?.id;
    const sameProfessional = selectedProfessional
      ? existingProfessionalId === selectedProfessional.id
      : !candidate.professional || !appointment.professional ||
        normalizeName(candidate.professional) === normalizeName(appointment.professional);
    return sameProfessional && start < existingEnd && end > existingStart;
  });
  return conflict ? "conflict" : null;
};

const appointmentSlotError = (issue: AppointmentSlotIssue) =>
  issue === "conflict"
    ? "Esse horário está ocupado ou fora da grade semanal do profissional. Escolha outro horário."
    : "O horário de término precisa ser posterior ao início.";

const serviceDurationMinutes = (duration: string): number | null => {
  const matches = Array.from(duration.matchAll(/(\d+(?:[.,]\d+)?)\s*(h(?:oras?)?|min(?:utos?)?)/gi));
  if (!matches.length) return null;
  const totalMinutes = matches.reduce((total, match) => {
    const amount = Number(match[1].replace(",", "."));
    return total + (match[2].toLocaleLowerCase("pt-BR").startsWith("h") ? amount * 60 : amount);
  }, 0);
  return Number.isFinite(totalMinutes) && totalMinutes > 0 ? Math.round(totalMinutes) : null;
};

const addAppointmentFromAgent = (phone: string, draft: AgentAppointmentDraft) => {
  if (!draft.confirmed) return { ok: false, reason: "invalid_data" } satisfies AgentAppointmentResult;
  const service = services.find(
    (item) => normalizeCatalogLabel(item.name) === normalizeCatalogLabel(draft.service),
  );
  const durationMinutes = service ? serviceDurationMinutes(service.duration) : null;
  if (!service || durationMinutes == null) {
    return { ok: false, reason: "invalid_service" } satisfies AgentAppointmentResult;
  }

  const fullLocalDateTime = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
  const startDate = fullLocalDateTime.test(draft.start)
    ? appointmentDateTimeInAgenda(draft.start)
    : null;
  if (!startDate || startDate.getTime() <= Date.now()) {
    return { ok: false, reason: "invalid_datetime" } satisfies AgentAppointmentResult;
  }
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  const start = formatAgendaDateTime(startDate);
  const end = formatAgendaDateTime(endDate);

  const normalizedPhone = normalizeWhatsappPhone(phone);
  let client = normalizedPhone
    ? clients.find((item) => normalizeWhatsappPhone(item.phone) === normalizedPhone)
    : undefined;
  const clientName = client?.name ?? draft.clientName.trim();
  const clientNameMatchesPhone = Boolean(
    normalizedPhone && normalizeWhatsappPhone(clientName) === normalizedPhone,
  );
  if (!client && (!clientName || clientNameMatchesPhone)) {
    return { ok: false, reason: "missing_client_name" } satisfies AgentAppointmentResult;
  }

  const requestedProfessional = normalizeCatalogLabel(draft.professional);
  const professionalName = /^(?:equipe|qualquer(?: profissional)?|sem preferencia|indiferente|tanto faz)$/.test(
    requestedProfessional,
  ) ? "" : draft.professional.trim();
  const matchedProfessional = professionalName
    ? professionals.find((item) =>
        item.active && normalizeCatalogLabel(item.name) === normalizeCatalogLabel(professionalName),
      )
    : undefined;
  if (professionalName && !matchedProfessional) {
    return { ok: false, reason: "invalid_professional" } satisfies AgentAppointmentResult;
  }
  const assignedProfessional = matchedProfessional?.name ?? "";

  const startTimestamp = startDate.getTime();
  const existingForClient = appointments.find((appointment) => {
    if (
      !appointmentBlocksTime(appointment) ||
      normalizeCatalogLabel(appointment.client) !== normalizeCatalogLabel(clientName) ||
      normalizeCatalogLabel(appointment.service) !== normalizeCatalogLabel(service.name)
    ) {
      return false;
    }
    const existingStart = appointmentDateTimeInAgenda(appointment.start)?.getTime();
    const sameProfessional = !assignedProfessional || !appointment.professional ||
      normalizeCatalogLabel(assignedProfessional) === normalizeCatalogLabel(appointment.professional);
    return sameProfessional && existingStart === startTimestamp;
  });
  if (existingForClient) return { ok: true, appointment: existingForClient } satisfies AgentAppointmentResult;

  const slotIssue = appointmentSlotIssue({
    start,
    end,
    professional: assignedProfessional,
    professionalId: matchedProfessional?.id ?? null,
  });
  if (slotIssue === "conflict") return { ok: false, reason: "conflict" } satisfies AgentAppointmentResult;
  if (slotIssue === "invalid") return { ok: false, reason: "invalid_datetime" } satisfies AgentAppointmentResult;

  if (!client) {
    client = {
      id: nextId(clients),
      name: clientName,
      initials: getInitials(clientName),
      lastVisit: "",
      service: service.name,
      status: "new",
      source: "WhatsApp",
      phone: normalizedPhone,
      email: "",
      notes: "Cliente cadastrado a partir de conversa no WhatsApp.",
    };
    clients.unshift(client);
  }
  const appointment: Appointment = {
    id: nextId(appointments),
    start,
    end,
    client: client.name,
    service: service.name,
    professional: assignedProfessional,
    professionalId: matchedProfessional?.id ?? null,
    room: "",
    status: "confirmed",
    attendance: "pending",
    avatar: getInitials(client.name),
  };
  appointments.push(appointment);
  return { ok: true, appointment } satisfies AgentAppointmentResult;
};

const agentAppointmentFailureReply = (reason: AgentAppointmentFailure) => {
  if (reason === "conflict") return "Esse horário não está disponível. Quer tentar outro horário? 🙂";
  if (reason === "invalid_service") return "Não consegui confirmar qual serviço da nossa lista você quer agendar. Qual atendimento prefere? 🤎";
  if (reason === "invalid_professional") return "Não encontrei esse profissional na equipe ativa. Você prefere outro nome ou sem preferência? 🤎";
  if (reason === "missing_client_name") return "Para registrar o atendimento, pode me dizer seu nome, por favor? 🤎";
  if (reason === "invalid_datetime") return "Não consegui validar essa data e esse horário. Pode me enviar o dia e horário exatos novamente? 🤎";
  return "Não consegui ler os dados do agendamento com segurança. Pode me enviar o serviço, dia e horário novamente? 🤎";
};

export const runWhatsappReminders = async () => {
  await ensureSpaOperationalStateLoaded();
  await spaOperationalStateWriteQueue;
  if (spaOperationalStateStore.status === "ready") {
    await refreshSpaOperationalState();
  }
  if (
    process.env["NODE_ENV"] === "production" &&
    spaOperationalStateStore.status !== "ready"
  ) {
    return;
  }
  await loadWhatsappSettings();
  if (!whatsappAutomation.enabled) return;
  const now = Date.now();
  for (const appointment of appointments) {
    if (appointment.status !== "confirmed") continue;
    const date = appointmentDateTimeInAgenda(appointment.start);
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

const cancelPendingWhatsappFollowUps = async (conversationId: number) => {
  await db
    .update(whatsappFollowupsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(
      eq(whatsappFollowupsTable.conversationId, conversationId),
      eq(whatsappFollowupsTable.status, "pending"),
    ));
};

export const runWhatsappFollowUps = async () => {
  await loadWhatsappSettings();
  const now = new Date();
  const followUpsEnabled =
    whatsappAutomation.enabled &&
    whatsappAutomation.aiReplies &&
    whatsappAutomation.followUp30m &&
    aiAgentConfig.active;

  // A process restart during an outbound request must not leave a candidate permanently locked.
  await db
    .update(whatsappFollowupsTable)
    .set({ status: "failed", error: "Envio interrompido antes da confirmação.", updatedAt: now })
    .where(and(
      eq(whatsappFollowupsTable.status, "processing"),
      lte(whatsappFollowupsTable.claimedAt, new Date(now.getTime() - 5 * 60_000)),
    ));

  if (!followUpsEnabled) {
    await db
      .update(whatsappFollowupsTable)
      .set({ status: "cancelled", updatedAt: now })
      .where(eq(whatsappFollowupsTable.status, "pending"));
    return;
  }

  const dueFollowUps = await db
    .select()
    .from(whatsappFollowupsTable)
    .where(and(
      eq(whatsappFollowupsTable.status, "pending"),
      lte(whatsappFollowupsTable.dueAt, now),
    ))
    .orderBy(asc(whatsappFollowupsTable.dueAt))
    .limit(50);

  for (const followUp of dueFollowUps) {
    const [claimed] = await db
      .update(whatsappFollowupsTable)
      .set({ status: "processing", claimedAt: now, updatedAt: now })
      .where(and(
        eq(whatsappFollowupsTable.id, followUp.id),
        eq(whatsappFollowupsTable.status, "pending"),
        lte(whatsappFollowupsTable.dueAt, now),
      ))
      .returning();
    if (!claimed) continue;

    try {
      const [[conversation], [triggerMessage], [newerInboundMessage]] = await Promise.all([
        db.select().from(whatsappConversationsTable)
          .where(eq(whatsappConversationsTable.id, followUp.conversationId)).limit(1),
        db.select().from(whatsappMessagesTable)
          .where(eq(whatsappMessagesTable.id, followUp.triggerMessageId)).limit(1),
        db.select({ id: whatsappMessagesTable.id }).from(whatsappMessagesTable)
          .where(and(
            eq(whatsappMessagesTable.conversationId, followUp.conversationId),
            eq(whatsappMessagesTable.direction, "inbound"),
            gt(whatsappMessagesTable.id, followUp.triggerMessageId),
          ))
          .orderBy(asc(whatsappMessagesTable.id))
          .limit(1),
      ]);

      if (
        !conversation ||
        conversation.status !== "agent" ||
        !triggerMessage ||
        triggerMessage.direction !== "outbound" ||
        triggerMessage.kind !== "reply" ||
        !["sent", "delivered"].includes(triggerMessage.status) ||
        newerInboundMessage
      ) {
        await db
          .update(whatsappFollowupsTable)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(whatsappFollowupsTable.id, followUp.id));
        continue;
      }

      const sentMessage = await sendWhatsappReply(
        conversation.phone,
        conversation.clientName,
        triggerMessage.appointmentId,
        followUpMessageForAgentQuestion,
        "reply",
      );
      await db
        .update(whatsappFollowupsTable)
        .set({
          status: sentMessage.status === "sent" ? "sent" : "failed",
          sentMessageId: sentMessage.id,
          error: sentMessage.error,
          updatedAt: new Date(),
        })
        .where(eq(whatsappFollowupsTable.id, followUp.id));
      if (sentMessage.status !== "sent") {
        logger.warn(
          { phone: conversation.phone, followUpId: followUp.id, error: sentMessage.error },
          "WhatsApp inactivity follow-up failed",
        );
      }
    } catch (error) {
      await db
        .update(whatsappFollowupsTable)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message.slice(0, 1000) : "Falha no envio.",
          updatedAt: new Date(),
        })
        .where(eq(whatsappFollowupsTable.id, followUp.id));
      logger.error({ err: error, followUpId: followUp.id }, "WhatsApp inactivity follow-up failed");
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
  instructions: "Responda de forma clara, curta e cordial. Faça uma pergunta por vez. Não peça o nome na saudação inicial; pergunte-o naturalmente depois da primeira resposta se ainda não souber.",
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

type ArchiveEntityType =
  | "appointment"
  | "client"
  | "lead"
  | "service"
  | "quote"
  | "financialMovement"
  | "professional"
  | "commissionRule"
  | "inventory"
  | "whatsappConversation";
type ArchivedSpaRecord = {
  entity: ArchiveEntityType;
  id: string;
  archivedAt: string;
  label: string;
};
const archivedSpaRecords: ArchivedSpaRecord[] = [];

const getInitials = (name: string) =>
  name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const nextId = (items: Array<{ id: number }>) =>
  Math.max(0, ...items.map((item) => item.id)) + 1;

const isSpaRecordArchived = (entity: ArchiveEntityType, id: string | number) =>
  archivedSpaRecords.some((entry) => entry.entity === entity && entry.id === String(id));

const activeSpaRecords = <T extends { id: number }>(entity: ArchiveEntityType, records: T[]) =>
  records.filter((record) => !isSpaRecordArchived(entity, record.id));

const archiveCollection = (
  entity: Exclude<ArchiveEntityType, "whatsappConversation">,
): Array<{ id: number }> => {
  switch (entity) {
    case "appointment": return appointments;
    case "client": return clients;
    case "lead": return leads;
    case "service": return services;
    case "quote": return quotes;
    case "financialMovement": return financialMovements;
    case "professional": return professionals;
    case "commissionRule": return commissionRules;
    case "inventory": return inventory;
  }
};

const archiveLabel = (entity: ArchiveEntityType, record: Record<string, unknown>) => {
  const value = (key: string) => String(record[key] ?? "").trim();
  switch (entity) {
    case "appointment": return [value("client"), value("service"), value("start")].filter(Boolean).join(" · ");
    case "client": return value("name") || `Cliente ${value("id")}`;
    case "lead": return value("name") || `Lead ${value("id")}`;
    case "service": return value("name") || `Serviço ${value("id")}`;
    case "quote": return [value("number"), value("clientName")].filter(Boolean).join(" · ");
    case "financialMovement": return [value("description"), value("date")].filter(Boolean).join(" · ");
    case "professional": return value("name") || `Profissional ${value("id")}`;
    case "commissionRule": return [value("serviceName"), `Profissional ${value("professionalId")}`].filter(Boolean).join(" · ");
    case "inventory": return value("name") || `Produto ${value("id")}`;
    case "whatsappConversation":
      return [value("clientName"), value("phone")].filter(Boolean).join(" · ") || "Conversa do WhatsApp";
  }
};

const resolveArchiveTarget = async (
  entity: ArchiveEntityType,
  rawId: string,
): Promise<ArchivedSpaRecord | null> => {
  if (entity === "whatsappConversation") {
    const id = normalizeWhatsappPhone(rawId);
    if (!id) return null;
    const conversation = await getWhatsappConversation(id);
    if (!conversation) return null;
    return {
      entity,
      id,
      archivedAt: "",
      label: archiveLabel(entity, { clientName: conversation.clientName, phone: conversation.phone }),
    };
  }

  if (!/^\d+$/.test(rawId)) return null;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) return null;
  const record = archiveCollection(entity).find((item) => item.id === id);
  if (!record) return null;
  return {
    entity,
    id: String(id),
    archivedAt: "",
    label: archiveLabel(entity, record as Record<string, unknown>),
  };
};

const archiveResolvedSpaRecord = (target: ArchivedSpaRecord) => {
  const existing = archivedSpaRecords.find((entry) => entry.entity === target.entity && entry.id === target.id);
  if (existing) return { entry: existing, changed: false };
  const archived = { ...target, archivedAt: new Date().toISOString() };
  archivedSpaRecords.push(archived);
  return { entry: archived, changed: true };
};

const archiveSpaRecord = async (entity: ArchiveEntityType, id: string) => {
  const target = await resolveArchiveTarget(entity, id);
  return target ? archiveResolvedSpaRecord(target).entry : null;
};

const restoreSpaRecord = (entity: ArchiveEntityType, id: string) => {
  const normalizedId = entity === "whatsappConversation"
    ? normalizeWhatsappPhone(id)
    : /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) ? String(Number(id)) : id;
  const index = archivedSpaRecords.findIndex((entry) => entry.entity === entity && entry.id === normalizedId);
  if (index < 0) return null;
  return archivedSpaRecords.splice(index, 1)[0] ?? null;
};

type SpaOperationalSnapshot = {
  version: 1;
  appointments: Appointment[];
  professionals: Professional[];
  commissionConfigs: CommissionConfig[];
  commissionRules: CommissionRule[];
  commissionClosures: CommissionClosure[];
  commissionAudit: CommissionAudit[];
  financialMovements: FinancialMovement[];
  clients: typeof clients;
  leads: Lead[];
  quotes: Quote[];
  services: typeof services;
  inventory: typeof inventory;
  archivedSpaRecords: ArchivedSpaRecord[];
};

const createSpaOperationalSnapshot = (): SpaOperationalSnapshot => ({
  version: 1,
  appointments: clone(appointments),
  professionals: clone(professionals),
  commissionConfigs: clone([...commissionConfigs.values()]),
  commissionRules: clone(commissionRules),
  commissionClosures: clone(commissionClosures),
  commissionAudit: clone(commissionAudit),
  financialMovements: clone(financialMovements),
  clients: clone(clients),
  leads: clone(leads),
  quotes: clone(quotes),
  services: clone(services),
  inventory: clone(inventory),
  archivedSpaRecords: clone(archivedSpaRecords),
});

const restoreSpaOperationalSnapshot = (value: unknown) => {
  if (!value || typeof value !== "object") {
    throw new Error("Stored SPA operational state is not an object.");
  }
  const candidate = value as Record<string, unknown>;
  const collectionKeys = [
    "appointments",
    "professionals",
    "commissionConfigs",
    "commissionRules",
    "commissionClosures",
    "commissionAudit",
    "financialMovements",
    "clients",
    "leads",
    "quotes",
    "services",
    "inventory",
  ] as const;
  if (
    candidate.version !== 1 ||
    collectionKeys.some((key) => !Array.isArray(candidate[key])) ||
    (candidate.archivedSpaRecords !== undefined && !Array.isArray(candidate.archivedSpaRecords))
  ) {
    throw new Error("Stored SPA operational state has an unsupported shape.");
  }

  const snapshot = candidate as unknown as SpaOperationalSnapshot;
  const archiveEntries = (candidate.archivedSpaRecords ?? []) as ArchivedSpaRecord[];
  if (archiveEntries.some((entry) =>
    !entry ||
    typeof entry !== "object" ||
    typeof entry.entity !== "string" ||
    typeof entry.id !== "string" ||
    typeof entry.archivedAt !== "string" ||
    typeof entry.label !== "string"
  )) {
    throw new Error("Stored SPA archive state has an unsupported shape.");
  }
  const replace = <T>(target: T[], source: T[]) => {
    target.splice(0, target.length, ...source);
  };
  replace(appointments, snapshot.appointments);
  replace(professionals, snapshot.professionals);
  replace(commissionRules, snapshot.commissionRules);
  replace(commissionClosures, snapshot.commissionClosures);
  replace(commissionAudit, snapshot.commissionAudit);
  replace(financialMovements, snapshot.financialMovements);
  replace(clients, snapshot.clients);
  replace(leads, snapshot.leads);
  replace(quotes, snapshot.quotes);
  replace(services, snapshot.services);
  replace(inventory, snapshot.inventory);
  replace(archivedSpaRecords, archiveEntries);
  commissionConfigs.clear();
  for (const config of snapshot.commissionConfigs) {
    commissionConfigs.set(config.professionalId, config);
  }
};

const spaOperationalStateStore = createSpaOperationalStateStore({
  repository: spaOperationalStateRepository,
  createSnapshot: createSpaOperationalSnapshot,
  restoreSnapshot: restoreSpaOperationalSnapshot,
  importApproved:
    process.env["SPA_INITIAL_IMPORT_APPROVED"] === "true" &&
    process.env["SPA_INITIAL_BACKUP_CONFIRMED"] === "true",
  version: 1,
});
let spaStateTableUnavailable = false;
let spaStateTableWarningLogged = false;
let spaStateImportLogged = false;
let spaStateEverReady = false;
let spaStateMemoryFallbackEnabled = false;

const postgresErrorCode = (error: unknown): string | undefined => {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth += 1) {
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
};

const markSpaStateTableUnavailable = () => {
  spaStateMemoryFallbackEnabled =
    !spaStateEverReady && process.env["NODE_ENV"] === "development";
  spaOperationalStateStore.markNotInitialized();
  spaStateTableUnavailable = true;
  if (!spaStateTableWarningLogged) {
    logger.warn(
      "SPA operational-state table is unavailable; persistence is disabled until it is migrated.",
    );
    spaStateTableWarningLogged = true;
  }
};

const ensureSpaOperationalStateLoaded = async () => {
  if (spaStateTableUnavailable) return;
  try {
    await spaOperationalStateStore.ensureLoaded();
  } catch (error) {
    if (postgresErrorCode(error) !== "42P01") throw error;
    markSpaStateTableUnavailable();
    return;
  }

  if (spaOperationalStateStore.status === "ready") spaStateEverReady = true;
  if (spaOperationalStateStore.importedInitialState && !spaStateImportLogged) {
    const snapshot = createSpaOperationalSnapshot();
    logger.info(
      {
        counts: {
          appointments: snapshot.appointments.length,
          clients: snapshot.clients.length,
          professionals: snapshot.professionals.length,
          services: snapshot.services.length,
          inventory: snapshot.inventory.length,
          financialMovements: snapshot.financialMovements.length,
          quotes: snapshot.quotes.length,
        },
      },
      "Imported the approved initial SPA dataset into PostgreSQL.",
    );
    spaStateImportLogged = true;
  }
};

const refreshSpaOperationalState = async () => {
  if (spaStateTableUnavailable) return;
  try {
    await spaOperationalStateStore.refresh();
    if (spaOperationalStateStore.status === "ready") spaStateEverReady = true;
  } catch (error) {
    if (postgresErrorCode(error) !== "42P01") throw error;
    markSpaStateTableUnavailable();
  }
};

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
  return appointment.professionalId != null
    ? professionals.find((professional) => professional.id === appointment.professionalId)
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
        ? activeSpaRecords("commissionRule", commissionRules).find((entry) => entry.professionalId === professional.id && entry.serviceId === service.id && entry.active)
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

let spaOperationalStateWriteQueue = Promise.resolve();
const acquireSpaOperationalStateWriteLock = async () => {
  let unlock!: () => void;
  const lock = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const previous = spaOperationalStateWriteQueue;
  spaOperationalStateWriteQueue = previous.then(() => lock);
  await previous;
  return unlock;
};

const mutatesOperationalState = (req: Request) =>
  !["GET", "HEAD", "OPTIONS"].includes(req.method) ||
  (req.method === "GET" &&
    (req.path.startsWith("/public/quotes/") ||
      /^\/professionals\/\d+\/commission-config$/.test(req.path)));

router.use(async (req, res, next) => {
  let releaseProcessLock: (() => void) | undefined;
  let releaseDatabaseLock: (() => Promise<void>) | undefined;
  let releasePromise: Promise<void> | undefined;
  const releaseHeldLocks = () => {
    if (!releasePromise) {
      releasePromise = (async () => {
        try {
          await releaseDatabaseLock?.();
        } catch (error) {
          logger.error({ err: error }, "Failed to release SPA operational-state database lock");
        } finally {
          releaseProcessLock?.();
          releaseProcessLock = undefined;
        }
      })();
    }
    return releasePromise;
  };
  const respondStateNotInitialized = () =>
    res.status(503).json({
      error:
        "Os dados do spa ainda não foram inicializados no PostgreSQL. Faça e confirme um backup antes de habilitar a importação inicial.",
    });

  const isWhatsappConnectionManagementRequest =
    (req.method === "GET" && req.path === "/whatsapp/connection") ||
    (req.method === "POST" && req.path === "/whatsapp/connect") ||
    (req.method === "POST" && req.path === "/whatsapp/disconnect");

  // Connection management talks to Evolution and does not mutate the SPA operational snapshot.
  // Keep it available while the production snapshot is being initialized.
  if (isWhatsappConnectionManagementRequest) {
    next();
    return;
  }

  try {
    await ensureSpaOperationalStateLoaded();
    const isMutation = mutatesOperationalState(req);

    if (!isMutation && spaOperationalStateStore.status === "ready") {
      await spaOperationalStateWriteQueue;
      await refreshSpaOperationalState();
    }

    if (spaOperationalStateStore.status !== "ready") {
      if (!spaStateMemoryFallbackEnabled) {
        respondStateNotInitialized();
        return;
      }
      next();
      return;
    }

    if (!isMutation) {
      next();
      return;
    }

    releaseProcessLock = await acquireSpaOperationalStateWriteLock();
    releaseDatabaseLock = await acquireSpaOperationalStateLock();
    await refreshSpaOperationalState();
    if (spaOperationalStateStore.status !== "ready") {
      await releaseHeldLocks();
      if (!spaStateMemoryFallbackEnabled) {
        respondStateNotInitialized();
        return;
      }
      next();
      return;
    }

    const before = createSpaOperationalSnapshot();
    let responseEndStarted = false;

    res.once("close", () => {
      if (responseEndStarted) return;
      restoreSpaOperationalSnapshot(before);
      void releaseHeldLocks();
    });

    const originalEnd = res.end.bind(res);
    res.end = ((...args: Parameters<typeof res.end>) => {
      if (responseEndStarted) return res;
      responseEndStarted = true;

      if (res.statusCode >= 500) {
        restoreSpaOperationalSnapshot(before);
        void releaseHeldLocks().then(() => originalEnd(...args));
        return res;
      }

      void spaOperationalStateStore
        .persist()
        .then(async () => {
          await releaseHeldLocks();
          try {
            originalEnd(...args);
          } catch (error) {
            logger.error({ err: error }, "Failed to finish SPA response after persisting state");
            throw error;
          }
        })
        .catch(async (error: unknown) => {
          restoreSpaOperationalSnapshot(before);
          logger.error(
            { err: error, method: req.method, path: req.path },
            "Failed to persist SPA operational state",
          );
          if (res.headersSent) {
            res.destroy(error instanceof Error ? error : undefined);
            await releaseHeldLocks();
            return;
          }

          res.statusCode = 500;
          res.removeHeader("Content-Length");
          res.removeHeader("ETag");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          try {
            originalEnd(
              JSON.stringify({
                error: "Não foi possível salvar os dados. Tente novamente.",
              }),
            );
          } finally {
            await releaseHeldLocks();
          }
        });

      return res;
    }) as typeof res.end;

    next();
  } catch (error) {
    await releaseHeldLocks();
    next(error);
  }
});

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
      (appointment) => appointment.status === "in_progress" &&
        !isSpaRecordArchived("appointment", appointment.id),
    ),
  });
  res.json(data);
});

router.get("/archive", (_req, res) => {
  const archived = [...archivedSpaRecords].sort(
    (left, right) => right.archivedAt.localeCompare(left.archivedAt),
  );
  res.json(ListArchivedRecordsResponse.parse(archived));
});

router.post("/archive/bulk", async (req, res): Promise<void> => {
  try {
    const input = ManageArchivedRecordsBody.parse(req.body);
    const uniqueRefs = [...new Map(
      input.records.map((record) => [`${record.entity}:${record.id}`, record]),
    ).values()];

    if (input.action === "archive") {
      const targets = await Promise.all(
        uniqueRefs.map((record) => resolveArchiveTarget(record.entity, record.id)),
      );
      if (targets.some((target) => !target)) {
        res.status(404).json({ error: "Um ou mais registros selecionados não foram encontrados. Nenhum item foi alterado." });
        return;
      }
      const resolvedTargets = [...new Map(
        targets
          .filter((target): target is ArchivedSpaRecord => target !== null)
          .map((target) => [`${target.entity}:${target.id}`, target]),
      ).values()];
      await Promise.all(
        resolvedTargets
          .filter((target) => target.entity === "professional" && /^\d+$/.test(target.id))
          .map((target) => disableStaffAccessForProfessional(Number(target.id))),
      );
      let changedCount = 0;
      const records = resolvedTargets.map((target) => {
        const result = archiveResolvedSpaRecord(target);
        if (result.changed) changedCount += 1;
        return result.entry;
      });
      res.json(ManageArchivedRecordsResponse.parse({
        action: input.action,
        changedCount,
        records,
      }));
      return;
    }

    const restoringMarkers = uniqueRefs
      .map((record) => {
        const normalizedId = record.entity === "whatsappConversation"
          ? normalizeWhatsappPhone(record.id)
          : /^\d+$/.test(record.id) && Number.isSafeInteger(Number(record.id)) ? String(Number(record.id)) : record.id;
        return archivedSpaRecords.find((entry) => entry.entity === record.entity && entry.id === normalizedId);
      })
      .filter((record): record is ArchivedSpaRecord => record !== undefined);
    const restoringRuleIds = new Set(
      restoringMarkers
        .filter((record) => record.entity === "commissionRule")
        .map((record) => Number(record.id)),
    );
    const activeRulesAfterRestore = commissionRules.filter(
      (rule) => !isSpaRecordArchived("commissionRule", rule.id) || restoringRuleIds.has(rule.id),
    );
    const ruleKeys = activeRulesAfterRestore.map((rule) => `${rule.professionalId}:${rule.serviceId}`);
    if (new Set(ruleKeys).size !== ruleKeys.length) {
      res.status(409).json({ error: "Não foi possível restaurar as regras: já existe uma regra ativa para o mesmo serviço e profissional." });
      return;
    }

    const restored = uniqueRefs
      .map((record) => restoreSpaRecord(record.entity, record.id))
      .filter((record): record is ArchivedSpaRecord => record !== null);
    res.json(ManageArchivedRecordsResponse.parse({
      action: input.action,
      changedCount: restored.length,
      records: restored,
    }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to archive or restore SPA records");
    throw error;
  }
});

router.get("/appointments", (req, res) => {
  const session = requestSession(res);
  const { date } = ListAppointmentsQueryParams.parse(req.query);
  const today = new Date().toLocaleDateString("sv-SE");
  let visibleAppointments = activeSpaRecords("appointment", appointments);
  if (session.role === "staff" && session.agendaScope === "own") {
    visibleAppointments = visibleAppointments.filter((appointment) =>
      appointmentBelongsToProfessional(appointment, session.professionalId!),
    );
  }
  const filtered = date
    ? visibleAppointments.filter((appointment) => {
        if (/^\d{2}:\d{2}/.test(appointment.start)) return date === today;
        return appointment.start.slice(0, 10) === date;
      })
    : visibleAppointments;
  res.json(ListAppointmentsResponse.parse(filtered));
});

router.post("/appointments", (req, res) => {
  const input = CreateAppointmentBody.parse(req.body);
  const session = requestSession(res);
  const scopedProfessional = session.role === "staff" && session.agendaScope === "own"
    ? activeSpaRecords("professional", professionals).find((professional) => professional.id === session.professionalId)
    : undefined;
  if (
    session.role === "staff" &&
    session.agendaScope === "own" &&
    (!scopedProfessional ||
      (input.professionalId != null && input.professionalId !== scopedProfessional.id) ||
      normalizeName(input.professional) !== normalizeName(scopedProfessional.name))
  ) {
    res.status(403).json({ error: "Você só pode criar agendamentos para sua própria agenda." });
    return;
  }
  const requestedProfessionalId = scopedProfessional?.id ?? input.professionalId;
  const requestedProfessionalName = scopedProfessional?.name ?? input.professional;
  const selectedProfessional = requestedProfessionalId != null
    ? activeSpaRecords("professional", professionals).find((professional) => professional.id === requestedProfessionalId)
    : activeSpaRecords("professional", professionals).find((professional) =>
        normalizeName(professional.name) === normalizeName(requestedProfessionalName),
      );
  if (requestedProfessionalId != null && !selectedProfessional) {
    res.status(400).json({ error: "Profissional não encontrado." });
    return;
  }
  if (selectedProfessional && !selectedProfessional.active) {
    res.status(400).json({ error: "Não é possível agendar com um profissional inativo." });
    return;
  }
  const professionalName = selectedProfessional?.name ?? requestedProfessionalName;
  const professionalId = selectedProfessional?.id ?? null;
  const slotIssue = appointmentSlotIssue({
    start: input.start,
    end: input.end,
    professional: professionalName,
    professionalId,
  });
  if (slotIssue) {
    const status = slotIssue === "conflict" ? 409 : 400;
    res.status(status).json({ error: appointmentSlotError(slotIssue) });
    return;
  }
  const appointment: Appointment = {
    id: nextId(appointments),
    ...input,
    professional: professionalName,
    professionalId,
    status: "confirmed",
    attendance: input.attendance ?? "pending",
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
  if (!appointment) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }
  const session = requestSession(res);
  if (session.role === "staff" && session.agendaScope === "own") {
    const ownProfessional = professionals.find((professional) => professional.id === session.professionalId);
    if (!ownProfessional || !appointmentBelongsToProfessional(appointment, session.professionalId!)) {
      res.status(404).json({ error: "Agendamento não encontrado." });
      return;
    }
    if (
      (input.professionalId != null && input.professionalId !== ownProfessional.id) ||
      (input.professional !== undefined && normalizeName(input.professional) !== normalizeName(ownProfessional.name))
    ) {
      res.status(403).json({ error: "Você só pode manter o agendamento na sua própria agenda." });
      return;
    }
  }
  const professionalWasUpdated =
    input.professional !== undefined || input.professionalId !== undefined;
  const selectedProfessional = input.professionalId != null
    ? activeSpaRecords("professional", professionals).find((professional) => professional.id === input.professionalId)
    : input.professional !== undefined
      ? activeSpaRecords("professional", professionals).find((professional) =>
          normalizeName(professional.name) === normalizeName(input.professional!),
        )
      : professionalForAppointment(appointment);
  if (input.professionalId != null && !selectedProfessional) {
    res.status(400).json({ error: "Profissional não encontrado." });
    return;
  }
  if (professionalWasUpdated && selectedProfessional && !selectedProfessional.active) {
    res.status(400).json({ error: "Não é possível agendar com um profissional inativo." });
    return;
  }
  const nextProfessionalName = professionalWasUpdated
    ? selectedProfessional?.name ?? input.professional ?? appointment.professional
    : appointment.professional;
  const nextProfessionalId = professionalWasUpdated
    ? selectedProfessional?.id ?? null
    : appointment.professionalId;
  const nextStatus = input.status ?? appointment.status;
  const scheduleChanged =
    (input.start ?? appointment.start) !== appointment.start ||
    (input.end ?? appointment.end) !== appointment.end ||
    nextProfessionalName !== appointment.professional ||
    nextProfessionalId !== appointment.professionalId ||
    (input.status !== undefined && input.status !== appointment.status);
  if (
    scheduleChanged &&
    (nextStatus === "confirmed" || nextStatus === "in_progress")
  ) {
    const slotIssue = appointmentSlotIssue({
      start: input.start ?? appointment.start,
      end: input.end ?? appointment.end,
      professional: nextProfessionalName,
      professionalId: nextProfessionalId,
    }, appointment.id);
    if (slotIssue) {
      const status = slotIssue === "conflict" ? 409 : 400;
      res.status(status).json({ error: appointmentSlotError(slotIssue) });
      return;
    }
  }
  Object.assign(
    appointment,
    input,
    { professional: nextProfessionalName, professionalId: nextProfessionalId },
    input.client ? { avatar: getInitials(input.client) } : {},
  );
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

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const { id } = DeleteAppointmentParams.parse(req.params);
  const appointment = appointments.find((item) => item.id === id);
  const session = requestSession(res);
  if (session.role === "staff") {
    if (!appointment || appointment.client !== "Horário bloqueado") {
      res.status(403).json({ error: "Somente o administrador pode arquivar agendamentos." });
      return;
    }
    if (
      session.agendaScope === "own" &&
      !appointmentBelongsToProfessional(appointment, session.professionalId!)
    ) {
      res.status(404).json({ error: "Horário bloqueado não encontrado." });
      return;
    }
  }
  if (!await archiveSpaRecord("appointment", String(id))) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }
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
  const conversations = (await db
    .select()
    .from(whatsappConversationsTable)
    .orderBy(desc(whatsappConversationsTable.lastMessageAt)))
    .filter((conversation) => !isSpaRecordArchived("whatsappConversation", conversation.phone))
    .slice(0, limit);
  res.json(ListWhatsappConversationsResponse.parse(await Promise.all(conversations.map(toWhatsappConversation))));
});

router.patch("/whatsapp/conversations/:phone", async (req, res) => {
  const { phone } = UpdateWhatsappConversationParams.parse(req.params);
  const { status } = UpdateWhatsappConversationBody.parse(req.body);
  const conversation = await setWhatsappConversationStatus(phone, status);
  const summary = await toWhatsappConversation(conversation);
  res.json(UpdateWhatsappConversationResponse.parse(summary));
});

router.delete("/whatsapp/conversations/:phone", async (req, res): Promise<void> => {
  const { phone } = DeleteWhatsappConversationParams.parse(req.params);
  if (!await archiveSpaRecord("whatsappConversation", phone)) {
    res.status(404).json({ error: "Conversa não encontrada" });
    return;
  }
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
  restoreSpaRecord("whatsappConversation", phone);
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
    .filter((item) => (appointmentDateTimeInAgenda(item.start)?.getTime() ?? Number.MAX_SAFE_INTEGER) > Date.now())
    .sort((a, b) => (appointmentDateTimeInAgenda(a.start)?.getTime() ?? 0) - (appointmentDateTimeInAgenda(b.start)?.getTime() ?? 0))[0];
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
  const conversation = await getWhatsappConversation(phone);
  if (conversation) await cancelPendingWhatsappFollowUps(conversation.id);
  const knownClientName = client?.name ?? (
    conversation && normalizeWhatsappPhone(conversation.clientName) !== conversation.phone
      ? conversation.clientName
      : phone
  );
  if (Array.isArray(currentInput)) {
    const imagePart = currentInput.find((part) => part.type === "image_url");
    currentInput = [
      { type: "text", text: `Cliente: ${knownClientName}\nMensagem: ${text}\nAnalise a imagem recebida e responda de forma útil, sem inventar informações.` },
      ...(imagePart ? [imagePart] : []),
    ];
  } else {
    currentInput = `Cliente: ${knownClientName}\nMensagem: ${text}`;
  }
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
  if (asksForHuman) {
    await setWhatsappConversationStatus(phone, "human");
    await sendWhatsappReply(
      phone,
      knownClientName,
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
    await sendWhatsappAgentReply(
      phone,
      knownClientName,
      appointment?.id ?? null,
      isAudioMessage
        ? "Não consegui ouvir esse áudio. Pode enviar novamente ou escrever a mensagem, por favor? 🤎"
        : "Não consegui abrir essa imagem agora. Pode enviar novamente, por favor? 🤎",
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
      knownClientName,
      text,
      isFirstClientMessage,
      currentInput,
    );
    await saveWhatsappClientName(
      phone,
      decision.clientName ?? decision.appointment?.clientName ?? null,
    );
    const replyClientName = (await getWhatsappConversation(phone))?.clientName ?? knownClientName;
    let createdAppointment: Appointment | null = null;
    if (decision.appointmentDataInvalid) {
      await sendWhatsappAgentReply(
        phone,
        replyClientName,
        appointment?.id ?? null,
        "Não consegui ler os dados do agendamento com segurança. Pode me enviar o serviço, dia e horário novamente? 🤎",
        replyReference,
      );
      return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "replied" }));
    }
    if (decision.appointment && !decision.appointment.confirmed) {
      await sendWhatsappAgentReply(
        phone,
        replyClientName,
        appointment?.id ?? null,
        "Para reservar, preciso da sua confirmação explícita. Você confirma esse serviço, data e horário? 🤎",
        replyReference,
      );
      return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "replied" }));
    }
    if (decision.appointment?.confirmed) {
      const result = addAppointmentFromAgent(phone, decision.appointment);
      if (!result.ok) {
        await sendWhatsappAgentReply(
          phone,
          replyClientName,
          appointment?.id ?? null,
          agentAppointmentFailureReply(result.reason),
          replyReference,
        );
        return void res.json(ReceiveEvolutionWebhookResponse.parse({ received: true, action: "replied" }));
      }
      createdAppointment = result.appointment;
    }
    if (decision.document) {
      await sendWhatsappDocumentMessage(
        phone,
        replyClientName,
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
    let writtenReply = createdAppointment
      ? appointmentScheduledReply(createdAppointment)
      : decision.reply;
    const replyAppointmentId = createdAppointment?.id ?? appointment?.id ?? null;
    const shouldReplyBeforeAudio = Boolean(
      audioClip && /\b(bronze(?:amento|adas?)?|marquinhas?)\b/.test(normalizedText),
    );
    if (shouldReplyBeforeAudio) {
      await sendWhatsappAgentReply(
        phone,
        replyClientName,
        replyAppointmentId,
        writtenReply,
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
      if (createdAppointment) {
        await sendWhatsappReply(
          phone,
          replyClientName,
          replyAppointmentId,
          writtenReply,
          "reply",
          replyReference,
        );
      } else {
        await sendWhatsappAgentReply(
          phone,
          replyClientName,
          replyAppointmentId,
          writtenReply,
          replyReference,
        );
      }
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
  const visibleClients = activeSpaRecords("client", clients);
  const filtered = normalized
    ? visibleClients.filter((client) =>
        `${client.name} ${client.service} ${client.source}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      )
    : visibleClients;
  res.json(ListClientsResponse.parse(filtered));
});

router.post("/clients", (req, res) => {
  const input = CreateClientBody.parse(req.body);
  const normalizedPhone = input.phone.replace(/\D/g, "");
  if (normalizedPhone && clients.some((client) => client.phone.replace(/\D/g, "") === normalizedPhone)) {
    return void res.status(409).json({ error: "Já existe um cliente com este telefone" });
  }
  const id = nextId(clients);
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

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const { id } = DeleteClientParams.parse(req.params);
  if (!await archiveSpaRecord("client", String(id))) {
    res.status(404).json({ error: "Cliente não encontrado" });
    return;
  }
  res.status(204).end();
});

router.get("/leads", (_req, res) => {
  res.json(ListLeadsResponse.parse(activeSpaRecords("lead", leads)));
});

router.post("/leads", (req, res) => {
  const input = CreateLeadBody.parse(req.body);
  const lead: Lead = {
    id: nextId(leads),
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
  res.json(ListServicesResponse.parse(activeSpaRecords("service", services)));
});

router.get("/packages", (_req, res) => {
  res.json(packages);
});

const staffAccessAccountResponse = (account: typeof staffAccessAccountsTable.$inferSelect) => ({
  id: account.id,
  professionalId: account.professionalId,
  username: account.username,
  active: account.active,
  canAccessAgenda: account.canAccessAgenda,
  canAccessCommissions: account.canAccessCommissions,
  agendaScope: account.agendaScope,
  mustChangePassword: account.mustChangePassword,
});

const isAdminRequest = (res: Response) => {
  if (requestSession(res).role === "admin") return true;
  res.status(403).json({ error: "Somente o administrador pode gerenciar acessos." });
  return false;
};

router.get("/staff-access", async (_req, res): Promise<void> => {
  if (!isAdminRequest(res)) return;
  const accounts = await db
    .select()
    .from(staffAccessAccountsTable)
    .orderBy(asc(staffAccessAccountsTable.id));
  res.json(ListStaffAccessAccountsResponse.parse(accounts.map(staffAccessAccountResponse)));
});

router.post("/staff-access", async (req, res): Promise<void> => {
  if (!isAdminRequest(res)) return;
  const parsed = CreateStaffAccessAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const professional = activeSpaRecords("professional", professionals)
    .find((item) => item.id === parsed.data.professionalId);
  if (!professional || !professional.active) {
    res.status(400).json({ error: "Selecione uma profissional ativa." });
    return;
  }

  const username = parsed.data.username.trim().toLocaleLowerCase("en-US");
  if (username === getAdminUsername().toLocaleLowerCase("en-US")) {
    res.status(409).json({ error: "Esse usuário já está reservado para o administrador." });
    return;
  }
  const temporaryPassword = defaultStaffPasswordFromEmail(professional.email);
  if (!temporaryPassword) {
    res.status(400).json({
      error: "Cadastre um e-mail válido para esta profissional antes de criar o acesso.",
    });
    return;
  }
  const passwordRecord = createPasswordRecord(temporaryPassword);
  const [created] = await db
    .insert(staffAccessAccountsTable)
    .values({
      professionalId: professional.id,
      username,
      ...passwordRecord,
      active: true,
      canAccessAgenda: parsed.data.canAccessAgenda,
      canAccessCommissions: parsed.data.canAccessCommissions,
      agendaScope: parsed.data.agendaScope,
      mustChangePassword: true,
      sessionVersion: 1,
    })
    .onConflictDoNothing()
    .returning();
  if (!created) {
    res.status(409).json({ error: "Esta profissional já tem acesso ou o usuário já está em uso." });
    return;
  }

  const emailDelivery = await sendStaffAccessCredentialsEmail({
    email: professional.email,
    professionalName: professional.name,
    username,
    temporaryPassword,
  });
  if (!emailDelivery.sent) {
    logger.warn(
      { professionalId: professional.id, reason: emailDelivery.reason },
      "Could not send initial staff access email",
    );
  }

  res.status(201).json(CreateStaffAccessAccountResponse.parse({
    account: staffAccessAccountResponse(created),
    temporaryPassword,
    emailSent: emailDelivery.sent,
  }));
});

router.patch("/staff-access/:id", async (req, res): Promise<void> => {
  if (!isAdminRequest(res)) return;
  const params = UpdateStaffAccessAccountParams.safeParse(req.params);
  const parsed = UpdateStaffAccessAccountBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(staffAccessAccountsTable)
    .where(eq(staffAccessAccountsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Acesso não encontrado." });
    return;
  }
  if (parsed.data.active === true) {
    const professional = activeSpaRecords("professional", professionals)
      .find((item) => item.id === existing.professionalId);
    if (!professional?.active) {
      res.status(400).json({ error: "Reative a profissional antes de habilitar o acesso." });
      return;
    }
  }
  const [updated] = await db
    .update(staffAccessAccountsTable)
    .set({
      ...parsed.data,
      sessionVersion: existing.sessionVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(staffAccessAccountsTable.id, existing.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Acesso não encontrado." });
    return;
  }
  res.json(UpdateStaffAccessAccountResponse.parse(staffAccessAccountResponse(updated)));
});

router.post("/staff-access/:id/reset-password", async (req, res): Promise<void> => {
  if (!isAdminRequest(res)) return;
  const params = ResetStaffAccessPasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [existing] = await db
    .select()
    .from(staffAccessAccountsTable)
    .where(eq(staffAccessAccountsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Acesso não encontrado." });
    return;
  }

  const temporaryPassword = generateTemporaryPassword();
  const [updated] = await db
    .update(staffAccessAccountsTable)
    .set({
      ...createPasswordRecord(temporaryPassword),
      mustChangePassword: true,
      sessionVersion: existing.sessionVersion + 1,
      updatedAt: new Date(),
    })
    .where(eq(staffAccessAccountsTable.id, existing.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Acesso não encontrado." });
    return;
  }
  res.json(ResetStaffAccessPasswordResponse.parse({ temporaryPassword }));
});

router.get("/professionals", (_req, res) => {
  const session = requestSession(res);
  let visibleProfessionals = activeSpaRecords("professional", professionals);
  if (session.role === "staff") {
    if (!session.canAccessAgenda || session.agendaScope === "own") {
      visibleProfessionals = visibleProfessionals.filter((professional) =>
        professional.id === session.professionalId,
      );
    }
    visibleProfessionals = visibleProfessionals.map((professional) => ({
      ...professional,
      phone: "",
      email: "",
      commissionRate: session.canAccessCommissions && professional.id === session.professionalId
        ? professional.commissionRate
        : 0,
    }));
  }
  res.json(ListProfessionalsResponse.parse(visibleProfessionals));
});

router.get("/finance/movements", (req, res) => {
  const { month } = ListFinancialMovementsQueryParams.parse(req.query);
  const visibleMovements = activeSpaRecords("financialMovement", financialMovements);
  const filtered = month
    ? visibleMovements.filter((movement) => movement.date.startsWith(month))
    : visibleMovements;
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

router.delete("/finance/movements/:id", async (req, res): Promise<void> => {
  const { id } = DeleteFinancialMovementParams.parse(req.params);
  if (!await archiveSpaRecord("financialMovement", String(id))) {
    res.status(404).json({ error: "Movimentação não encontrada" });
    return;
  }
  res.status(204).end();
});

router.post("/professionals", (req, res) => {
  const input = CreateProfessionalBody.parse(req.body);
  const scheduleError = professionalScheduleError(input);
  if (scheduleError) return void res.status(400).json({ error: scheduleError });
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

router.patch("/professionals/:id", async (req, res): Promise<void> => {
  const { id } = UpdateProfessionalParams.parse(req.params);
  const input = UpdateProfessionalBody.parse(req.body);
  const professional = professionals.find((item) => item.id === id);
  if (!professional) return void res.status(404).json({ error: "Profissional não encontrado" });
  const scheduleError = professionalScheduleError(input);
  if (scheduleError) return void res.status(400).json({ error: scheduleError });
  if (input.active === false) await disableStaffAccessForProfessional(id);
  const previousName = professional.name;
  Object.assign(professional, input);
  for (const appointment of appointments) {
    if (
      appointment.professionalId === id ||
      (appointment.professionalId == null && normalizeName(appointment.professional) === normalizeName(previousName))
    ) {
      appointment.professional = professional.name;
      appointment.professionalId = id;
    }
  }
  if (input.commissionRate !== undefined) {
    const config = commissionConfigs.get(id);
    if (config) {
      config.defaultValue = input.commissionRate;
      config.updatedAt = new Date().toISOString();
    }
  }
  res.json(UpdateProfessionalResponse.parse(professional));
});

router.delete("/professionals/:id", async (req, res): Promise<void> => {
  const { id } = DeleteProfessionalParams.parse(req.params);
  if (!professionals.some((professional) => professional.id === id)) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
  await disableStaffAccessForProfessional(id);
  if (!await archiveSpaRecord("professional", String(id))) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
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
    const serviceTable = activeSpaRecords("service", services)
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
- Não peça o nome junto da saudação inicial. Em uma conversa real, se o nome ainda não for conhecido, pergunte-o naturalmente depois da primeira resposta e quando a cliente continuar a conversa.
- Só informe clientName se a cliente tiver dito o nome explicitamente; não deduza pelo telefone.
- Use somente os serviços, preços, durações e informações fornecidas acima.
- Nunca invente preço, promoção, disponibilidade ou política.
- Quando perguntarem sobre funcionamento, localização ou endereço, use os dados configurados. Não invente endereço nem trate apenas “Belém - PA” como endereço completo.
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

router.delete("/services/:id", async (req, res): Promise<void> => {
  const { id } = DeleteServiceParams.parse(req.params);
  if (!await archiveSpaRecord("service", String(id))) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }
  res.status(204).end();
});

router.get("/quotes", (req, res) => {
  const { search, status, from, to } = ListQuotesQueryParams.parse(req.query);
  const normalized = search?.toLocaleLowerCase("pt-BR");
  const filtered = activeSpaRecords("quote", quotes).filter((quote) =>
    (!normalized || `${quote.number} ${quote.clientName} ${quote.phone}`.toLocaleLowerCase("pt-BR").includes(normalized)) &&
    (!status || quote.status === status) &&
    (!from || quote.createdAt.slice(0, 10) >= from) &&
    (!to || quote.createdAt.slice(0, 10) <= to),
  );
  res.json(ListQuotesResponse.parse(filtered));
});

router.post("/quotes", (req, res) => {
  const input = CreateQuoteBody.parse(req.body);
  const client = activeSpaRecords("client", clients).find((entry) => entry.id === input.clientId);
  if (!client) return void res.status(400).json({ error: "Cliente não encontrado" });
  const items = input.items.map((item) => {
    const source = item.type === "service"
      ? activeSpaRecords("service", services).find((entry) => entry.id === item.refId)
      : item.type === "product"
        ? activeSpaRecords("inventory", inventory).find((entry) => entry.id === item.refId)
        : item.type === "package"
          ? packages.find((entry) => entry.id === item.refId)
          : undefined;
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
  const id = nextId(quotes);
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
  const professional = input.professionalId
    ? activeSpaRecords("professional", professionals).find((entry) => entry.id === input.professionalId)
    : undefined;
  if (input.professionalId && !professional) return void res.status(400).json({ error: "Profissional não encontrado" });
  const item = quote.items.find((entry) => entry.type === "service");
  const appointmentProfessional = professional?.name ?? item?.professionalName ?? "";
  const slotIssue = appointmentSlotIssue({
    start: input.start,
    end: input.end,
    professional: appointmentProfessional,
    professionalId: professional?.id ?? null,
  });
  if (slotIssue) {
    const status = slotIssue === "conflict" ? 409 : 400;
    res.status(status).json({ error: appointmentSlotError(slotIssue) });
    return;
  }
  const appointment: Appointment = {
    id: nextId(appointments),
    start: input.start,
    end: input.end,
    client: quote.clientName,
    service: item?.name ?? "Atendimento",
    professional: appointmentProfessional,
    professionalId: professional?.id ?? null,
    room: "",
    status: "confirmed",
    attendance: "pending",
    avatar: getInitials(quote.clientName),
  };
  appointments.push(appointment);
  res.status(201).json(appointment);
});

router.post("/quotes/:id/payment", (req, res) => {
  const { id } = CreateQuotePaymentParams.parse(req.params);
  const input = CreateQuotePaymentBody.parse(req.body);
  const quote = quotes.find((entry) => entry.id === id);
  if (!quote) return void res.status(404).json({ error: "Orçamento não encontrado" });
  if (quote.status !== "approved") return void res.status(400).json({ error: "Apenas orçamentos aprovados podem receber pagamento" });
  if (quote.paidAt || financialMovements.some((entry) => entry.quoteId === id)) return void res.status(409).json({ error: "Este orçamento já possui pagamento" });
  const movement: FinancialMovement = { id: nextId(financialMovements), type: "revenue", date: new Date().toISOString().slice(0, 10), description: `Pagamento do orçamento ${quote.number}`, category: "Orçamentos", amount: input.amount, status: "paid", client: quote.clientName, service: "", professional: "", quoteId: id, paymentMethod: input.paymentMethod, source: "quote" };
  financialMovements.unshift(movement); quote.paidAt = new Date().toISOString(); res.status(201).json(movement);
});

router.delete("/quotes/:id", async (req, res): Promise<void> => {
  const { id } = DeleteQuoteParams.parse(req.params);
  if (!await archiveSpaRecord("quote", String(id))) {
    res.status(404).json({ error: "Orçamento não encontrado" });
    return;
  }
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
  const visibleInventory = activeSpaRecords("inventory", inventory);
  const filtered = normalized
    ? visibleInventory.filter((item) =>
        `${item.name} ${item.brand} ${item.category}`
          .toLocaleLowerCase("pt-BR")
          .includes(normalized),
      )
    : visibleInventory;
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

router.delete("/inventory/:id", async (req, res): Promise<void> => {
  const { id } = DeleteInventoryItemParams.parse(req.params);
  if (!await archiveSpaRecord("inventory", String(id))) {
    res.status(404).json({ error: "Produto não encontrado" });
    return;
  }
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
  res.json(ListCommissionRulesResponse.parse(
    activeSpaRecords("commissionRule", commissionRules).filter((rule) => rule.professionalId === id),
  ));
});

router.post("/professionals/:id/commission-rules", (req, res) => {
  const { id } = CreateCommissionRuleParams.parse(req.params);
  const input = CreateCommissionRuleBody.parse(req.body);
  if (!professionals.some((professional) => professional.id === id)) {
    res.status(404).json({ error: "Profissional não encontrado" });
    return;
  }
  if (!activeSpaRecords("service", services).some((service) => service.id === input.serviceId)) {
    res.status(400).json({ error: "Serviço não encontrado" });
    return;
  }
  const service = activeSpaRecords("service", services).find((entry) => entry.id === input.serviceId)!;
  const duplicate = activeSpaRecords("commissionRule", commissionRules)
    .find((rule) => rule.professionalId === id && rule.serviceId === input.serviceId);
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
  const service = activeSpaRecords("service", services).find((entry) => entry.id === input.serviceId);
  if (!service) {
    res.status(400).json({ error: "Serviço não encontrado" });
    return;
  }
  const duplicate = activeSpaRecords("commissionRule", commissionRules)
    .find((entry) => entry.id !== ruleId && entry.professionalId === id && entry.serviceId === input.serviceId);
  if (duplicate) {
    res.status(409).json({ error: "Já existe uma regra para este serviço" });
    return;
  }
  Object.assign(rule, input, { serviceName: service.name });
  res.json(UpdateCommissionRuleResponse.parse(rule));
});

router.delete("/professionals/:id/commission-rules/:ruleId", async (req, res): Promise<void> => {
  const { id, ruleId } = DeleteCommissionRuleParams.parse(req.params);
  const rule = commissionRules.find((entry) => entry.id === ruleId && entry.professionalId === id);
  if (!rule || !await archiveSpaRecord("commissionRule", String(ruleId))) {
    res.status(404).json({ error: "Regra de comissão não encontrada" });
    return;
  }
  res.status(204).end();
});

router.get("/commissions/items", (req, res) => {
  const query = ListCommissionItemsQueryParams.parse(req.query);
  const session = requestSession(res);
  const professionalId = session.role === "staff" ? session.professionalId! : query.professionalId;
  const items = getCommissionItems(query.from, query.to, professionalId)
    .filter((item) => !query.status || item.status === query.status);
  res.json(ListCommissionItemsResponse.parse(items));
});

router.get("/commissions/items/:id", (req, res) => {
  const { id } = GetCommissionItemParams.parse(req.params);
  const item = getCommissionItems("0000-01-01", "9999-12-31").find((entry) => entry.id === id);
  const session = requestSession(res);
  if (!item || (session.role === "staff" && item.professionalId !== session.professionalId)) {
    res.status(404).json({ error: "Item de comissão não encontrado" });
    return;
  }
  res.json(GetCommissionItemResponse.parse(item));
});

router.get("/commissions/summary", (req, res) => {
  const query = GetCommissionsSummaryQueryParams.parse(req.query);
  const session = requestSession(res);
  const professionalId = session.role === "staff" ? session.professionalId! : query.professionalId;
  const items = getCommissionItems(query.from, query.to, professionalId)
    .filter((item) => !query.status || item.status === query.status);
  const eligibleAmount = items.reduce((sum, item) => sum + (item.commissionAmount ?? 0), 0);
  res.json(GetCommissionsSummaryResponse.parse({
    from: query.from,
    to: query.to,
    professionalId: professionalId ?? null,
    totalAmount: eligibleAmount,
    eligibleAmount,
    blockedCount: items.filter((item) => item.status === "blocked").length,
    itemCount: items.length,
    items,
  }));
});

router.get("/commissions/closures", (req, res) => {
  const query = ListCommissionClosuresQueryParams.parse(req.query);
  const session = requestSession(res);
  const professionalId = session.role === "staff" ? session.professionalId : query.professionalId;
  const result = commissionClosures.filter((closure) =>
    (professionalId == null || closure.professionalId === professionalId) &&
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
  const session = requestSession(res);
  const professionalId = session.role === "staff" ? session.professionalId : query.professionalId;
  const result = commissionAudit.filter((entry) =>
    (professionalId == null || entry.professionalId === professionalId) &&
    (!query.closureId || entry.closureId === query.closureId),
  );
  res.json(ListCommissionAuditResponse.parse(result));
});

export default router;