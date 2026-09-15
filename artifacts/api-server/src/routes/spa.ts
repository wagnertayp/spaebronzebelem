import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
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
import { openai } from "@workspace/integrations-openai-ai-server";
import backup from "../data/spa-backup.json";
import { requireSession } from "../lib/auth";

const router: IRouter = Router();

// All operational data is private; quote links remain public by design.
router.use((req, res, next) => {
  if (req.path.startsWith("/public/")) return next();
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
  phone: "",
  email: "",
  notes: "",
}));

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
  humanHandoff: "Encaminhe para uma atendente quando houver reclamação, dúvida clínica, negociação especial ou solicitação fora das informações disponíveis.",
};

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
  res.status(201).json(CreateAppointmentResponse.parse(appointment));
});

router.patch("/appointments/:id", (req, res) => {
  const { id } = UpdateAppointmentParams.parse(req.params);
  const input = UpdateAppointmentBody.parse(req.body);
  const appointment = appointments.find((item) => item.id === id);
  if (!appointment) return void res.status(404).json({ error: "Agendamento não encontrado" });
  Object.assign(appointment, input, input.client ? { avatar: getInitials(input.client) } : {});
  res.json(UpdateAppointmentResponse.parse(appointment));
});

router.delete("/appointments/:id", (req, res) => {
  const { id } = DeleteAppointmentParams.parse(req.params);
  const index = appointments.findIndex((item) => item.id === id);
  if (index < 0) return void res.status(404).json({ error: "Agendamento não encontrado" });
  appointments.splice(index, 1);
  res.status(204).end();
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
  res.json(GetAiAgentConfigResponse.parse(aiAgentConfig));
});

router.put("/ai-agent/config", (req, res) => {
  aiAgentConfig = UpdateAiAgentConfigBody.parse(req.body);
  res.json(UpdateAiAgentConfigResponse.parse(aiAgentConfig));
});

router.post("/ai-agent/test", async (req, res, next) => {
  try {
    const { message } = TestAiAgentBody.parse(req.body);
    const serviceTable = services
      .map((service) => `- ${service.name} | ${service.category} | ${service.duration} | ${service.price}`)
      .join("\n");
    const response = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
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

TABELA ATUAL DE SERVIÇOS E PREÇOS:
${serviceTable}

Regras obrigatórias:
- Responda em português do Brasil.
- Use somente os serviços, preços, durações e informações fornecidas acima.
- Nunca invente preço, promoção, disponibilidade ou política.
- Quando faltar informação, diga que vai encaminhar para uma atendente.
- Seja objetiva e acolhedora, sem textos longos.
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